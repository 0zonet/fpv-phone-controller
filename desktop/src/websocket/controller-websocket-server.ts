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
  onState?: (state: ControllerAxes, buttons: readonly boolean[]) => void;
  onPhoneConnected?: () => void;
  onPhoneDisconnected?: () => void;
  onControllerError?: (error: unknown) => void;
  getReportedAxes?: () => ControllerAxes;
  getControllerMetrics?: () => { updatesPerSecond: number; failsafe: boolean };
  debug?: boolean;
  httpServer?: HttpServer;
  /** true/'accept' admits the phone; 'invalid-token' upgrades only to close with 4003; false/'deny' refuses the handshake. */
  authorize?: (peer: string, origin: string | undefined, url: string) => boolean | 'accept' | 'invalid-token' | 'deny';
  /** PC → phone hello/ack (protocol 2). Default true; old phones ignore these messages. */
  acknowledge?: boolean;
  /** Every WebSocket upgrade attempt, accepted or rejected by `authorize` (PHONE_ATTEMPTED / PAIRING_REJECTED). */
  onConnectionAttempt?: (accepted: boolean) => void;
  /** Received packets per second of the connected phone, once per report interval. */
  onRate?: (packetsPerSecond: number) => void;
}
interface Client { readonly address: string; readonly metrics: ControllerMetrics; alive: boolean; ackedAt: number; }
/** PC → phone messages (protocol 2). Clients that predate them never listen to `message`. */
export const PROTOCOL_HELLO = JSON.stringify({ type: 'hello', protocol: 2, capabilities: ['ack', 'close-codes'] });
export const CLOSE_PAIRING_REJECTED = 4003;
const ACK_MIN_INTERVAL_MS = 500, ACK_HEARTBEAT_MS = 1000;
const rejectedRequests = new WeakSet<IncomingMessage>();

export function createControllerWebSocketServer(options: ControllerServerOptions = {}): WebSocketServer {
  const log = options.log ?? console.log;
  const server = new WebSocketServer({
    ...(options.httpServer ? { server: options.httpServer } : { port: options.port ?? defaultConfig.websocketPort,
      host: options.host ?? defaultConfig.websocketHost }),
    maxPayload: options.maxPayload ?? defaultConfig.maxPayload,
    verifyClient: (info: { req: IncomingMessage; origin: string }) => {
      const decision = options.authorize ? options.authorize(info.req.socket.remoteAddress ?? '', info.origin, info.req.url ?? '/') : true;
      const accepted = decision === true || decision === 'accept';
      try { options.onConnectionAttempt?.(accepted); } catch { /* Diagnostics only. */ }
      if (decision === 'invalid-token') { rejectedRequests.add(info.req); return true; }
      return accepted;
    }
  });
  const clients = new Map<WebSocket, Client>();
  const acknowledge = options.acknowledge ?? true;
  const sendAck = (socket: WebSocket, client: Client, now: number): void => {
    if (!acknowledge || client.metrics.lastSequence === null || socket.readyState !== WebSocket.OPEN) return;
    client.ackedAt = now;
    socket.send(JSON.stringify({ type: 'ack', sequence: client.metrics.lastSequence }));
  };
  server.on('connection', (socket, request) => {
    if (rejectedRequests.has(request)) { socket.close(CLOSE_PAIRING_REJECTED, 'Pairing rejected'); return; }
    if (clients.size >= (options.maxPhoneClients ?? defaultConfig.maxPhoneClients)) {
      socket.close(1008, 'Only one active phone is allowed'); return;
    }
    const address = request.socket.remoteAddress ?? 'unknown';
    const client: Client = { address, metrics: new ControllerMetrics(performance.now()), alive: true, ackedAt: -Infinity };
    let ended = false;
    const disconnectPhone = (): void => {
      if (ended) return;
      ended = true;
      try { options.onPhoneDisconnected?.(); } catch (failure) { options.onControllerError?.(failure); }
    };
    clients.set(socket, client);
    log('Client connected: ' + address);
    options.onPhoneConnected?.();
    if (acknowledge) socket.send(PROTOCOL_HELLO);
    socket.on('pong', () => { client.alive = true; });
    socket.on('message', (data, binary) => {
      let message: unknown;
      try { message = JSON.parse(data.toString()); }
      catch { socket.close(1008, 'Invalid JSON'); return; }
      if (binary || !isControllerMessage(message)) { socket.close(1008, 'Invalid controller-state'); return; }
      const now = performance.now();
      if (!client.metrics.receive(message, now)) return;
      // Ack right away (at most every 500 ms) so the phone measures the real round trip.
      if (now - client.ackedAt >= ACK_MIN_INTERVAL_MS) sendAck(socket, client, now);
      try {
        options.onState?.(message.axes, message.buttons ?? []);
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
      options.onRate?.(rate);
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
  // Liveness for the phone when nothing new arrived: repeats the last sequence (the phone ignores it for RTT).
  const acks = setInterval(() => {
    const now = performance.now();
    for (const [socket, client] of clients) if (now - client.ackedAt >= ACK_HEARTBEAT_MS) sendAck(socket, client, now);
  }, ACK_HEARTBEAT_MS / 2);
  reporting.unref(); heartbeat.unref(); acks.unref();
  server.on('close', () => { clearInterval(reporting); clearInterval(heartbeat); clearInterval(acks); clients.clear(); });
  server.on('error', () => { clearInterval(reporting); clearInterval(heartbeat); clearInterval(acks); });
  return server;
}
