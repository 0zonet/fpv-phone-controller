import { once } from 'node:events';
import type { AppConfig } from './config.js';
import type { VirtualController } from './controller/virtual-controller.js';
import { ControllerMapper } from './controller/controller-mapper.js';
import { ControllerSession } from './controller/controller-session.js';
import { createControllerWebSocketServer } from './websocket/controller-websocket-server.js';
import type { ControllerServerOptions } from './websocket/controller-websocket-server.js';
export interface CompanionHooks {
  httpServer?: ControllerServerOptions['httpServer'];
  authorize?: ControllerServerOptions['authorize'];
  onPhoneStatus?: (connected: boolean) => void;
}

export async function startCompanion(config: AppConfig, controller: VirtualController, log: (line: string) => void = console.log, hooks: CompanionHooks = {}) {
  const mapper = new ControllerMapper({ calibration: config.calibration });
  await controller.connect();
  log('Virtual controller: ' + config.controller.driver + ' device ' + config.controller.deviceId + ' ready');
  let shutdownPromise: Promise<void> | undefined;
  let session: ControllerSession;
  const fatal = (error: unknown): void => {
    log('Virtual controller error: ' + String(error)); process.exitCode = 1;
    void shutdown().catch(failure => log('Shutdown error: ' + String(failure)));
  };
  session = new ControllerSession(controller, mapper, config.controller.failsafeMs, log, undefined, fatal);
  const server = createControllerWebSocketServer({
    port: config.websocketPort, host: config.websocketHost, maxPayload: config.maxPayload,
    reportMs: config.reportMs, heartbeatMs: config.heartbeatMs, maxPhoneClients: config.maxPhoneClients, log,
    onState: state => session.receive(state),
    getReportedAxes: () => session.axes,
    getControllerMetrics: () => session.sampleMetrics(),
    debug: config.debug,
    httpServer: hooks.httpServer, authorize: hooks.authorize,
    onPhoneConnected: () => { log('Phone: connected'); hooks.onPhoneStatus?.(true); },
    onPhoneDisconnected: () => { log('Phone disconnected'); hooks.onPhoneStatus?.(false); session.disconnect(); },
    onControllerError: fatal
  });
  hooks.httpServer?.on('error', error => server.emit('error', error));
  function shutdown(): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    session.stop();
    shutdownPromise = (async () => {
      const errors: unknown[] = [];
      try { controller.reset(); } catch (error) { errors.push(error); }
      try { await controller.disconnect(); } catch (error) { errors.push(error); }
      const deadline = setTimeout(() => { for (const socket of server.clients) socket.terminate(); }, config.shutdownMs);
      deadline.unref();
      for (const socket of server.clients) socket.close(1001, 'Server shutting down');
      await new Promise<void>(resolve => server.close(() => resolve()));
      if (hooks.httpServer) await new Promise<void>(resolve => hooks.httpServer!.close(() => resolve()));
      clearTimeout(deadline);
      if (errors.length) throw new AggregateError(errors, 'Virtual controller cleanup failed.');
    })();
    return shutdownPromise;
  }
  try {
    if (hooks.httpServer) {
      const listening = once(server, 'listening');
      hooks.httpServer.listen(config.websocketPort, config.websocketHost);
      await listening;
    } else await once(server, 'listening');
  }
  catch (error) { await shutdown(); throw error; }
  server.on('error', fatal);
  log('WebSocket: listening on :' + config.websocketPort);
  return { server, shutdown };
}
