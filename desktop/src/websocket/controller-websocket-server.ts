import { WebSocket, WebSocketServer } from 'ws';
import { performance } from 'node:perf_hooks';
import { isControllerMessage } from '../models/controller-message.js';
import { ControllerMetrics } from './controller-metrics.js';
import { defaultConfig } from '../config.js';
import type { ControllerAxes } from '../../../shared/src/index.js';
import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';

export interface ControllerServerOptions {
  port?: number;
  host?: string;
  log?: (line: string) => void;
  maxPayload?: number;
  reportMs?: number;
  heartbeatMs?: number;
  maxPhoneClients?: number;
  onState?: (state: ControllerAxes) => void;
  onPhoneConnected?: () => void;
  onPhoneDisconnected?: () => void;
  onControllerError?: (error: unknown) => void;
  getReportedAxes?: () => ControllerAxes;
  getControllerMetrics?: () => { updatesPerSecond: number; failsafe: boolean };
  debug?: boolean;
  httpServer?: HttpServer;
  authorize?: (peer: string, origin: string | undefined, url: string) => boolean;
}
interface Client { readonly address: string; readonly metrics: ControllerMetrics; alive: boolean; }

export function createControllerWebSocketServer(options: ControllerServerOptions = {}): WebSocketServer {
  const log = options.log ?? console.log;
  const server = new WebSocketServer({
    ...(options.httpServer ? { server: options.httpServer } : { port: options.port ?? defaultConfig.websocketPort,
      host: options.host ?? defaultConfig.websocketHost }),
    maxPayload: options.maxPayload ?? defaultConfig.maxPayload,
    verifyClient: (info: { req: IncomingMessage; origin: string }) => !options.authorize || options.authorize(info.req.socket.remoteAddress ?? '', info.origin, info.req.url ?? '/')
  });
  const clients = new Map<WebSocket, Client>();
  server.on('connection', (socket, request) => {
    if (clients.size >= (options.maxPhoneClients ?? defaultConfig.maxPhoneClients)) {
      socket.close(1008, 'Only one active phone is allowed'); return;
    }
    const address = request.socket.remoteAddress ?? 'unknown';
    const client: Client = { address, metrics: new ControllerMetrics(performance.now()), alive: true };
    let ended = false;
    const disconnectPhone = (): void => {
      if (ended) return;
      ended = true;
      try { options.onPhoneDisconnected?.(); } catch (failure) { options.onControllerError?.(failure); }
    };
    clients.set(socket, client);
    log('Client connected: ' + address);
    options.onPhoneConnected?.();
    socket.on('pong', () => { client.alive = true; });
    socket.on('message', (data, binary) => {
      let message: unknown;
      try { message = JSON.parse(data.toString()); }
      catch { socket.close(1008, 'Invalid JSON'); return; }
      if (binary || !isControllerMessage(message)) { socket.close(1008, 'Invalid controller-state'); return; }
      if (!client.metrics.receive(message, performance.now())) return;
      try {
        options.onState?.(message.axes);
      } catch (error) {
        socket.close(1011, 'Virtual controller update failed'); options.onControllerError?.(error);
      }
    });
    socket.on('error', error => {
      log('WebSocket error: ' + error.message);
      disconnectPhone();
    });
    socket.on('close', () => {
      clients.delete(socket); log('Client disconnected: ' + address);
      disconnectPhone();
    });
  });
  const reporting = setInterval(() => {
    const now = performance.now();
    const outputMetrics = options.getControllerMetrics?.();
    for (const client of clients.values()) {
      const rate = client.metrics.sampleRate(now);
      const message = client.metrics.latest;
      if (!message) continue;
      const axes = options.getReportedAxes?.() ?? message.axes;
      if (options.debug) {
        const raw = message.axes;
        log('RAW THR ' + raw.throttle.toFixed(2) + ' | YAW ' + raw.yaw.toFixed(2)
          + ' | PIT ' + raw.pitch.toFixed(2) + ' | ROL ' + raw.roll.toFixed(2));
      }
      log('[' + client.address + '] ' + (options.debug ? 'CALIBRATED ' : '') + 'THR ' + axes.throttle.toFixed(2) + ' | YAW ' + axes.yaw.toFixed(2)
        + ' | PIT ' + axes.pitch.toFixed(2) + ' | ROL ' + axes.roll.toFixed(2)
        + ' | ' + rate.toFixed(0) + ' packets/s | SEQ ' + client.metrics.lastSequence
        + ' | LOST ' + client.metrics.lostPackets + ' | AGE ' + (now - client.metrics.receivedAt).toFixed(0) + ' ms'
        + (outputMetrics ? ' | ' + outputMetrics.updatesPerSecond.toFixed(0) + ' updates/s' : '')
        + (outputMetrics?.failsafe ? ' | FAILSAFE ACTIVE' : ''));
    }
  }, options.reportMs ?? defaultConfig.reportMs);
  const heartbeat = setInterval(() => {
    for (const [socket, client] of clients) {
      if (!client.alive) { socket.terminate(); continue; }
      client.alive = false;
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }
  }, options.heartbeatMs ?? defaultConfig.heartbeatMs);
  reporting.unref(); heartbeat.unref();
  server.on('close', () => { clearInterval(reporting); clearInterval(heartbeat); clients.clear(); });
  server.on('error', () => { clearInterval(reporting); clearInterval(heartbeat); });
  return server;
}
