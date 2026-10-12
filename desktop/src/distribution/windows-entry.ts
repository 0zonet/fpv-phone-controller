import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { loadConfig } from '../config.js';
import { startCompanion } from '../companion.js';
import { VJoyController } from '../drivers/vjoy/vjoy-controller.js';
import { FakeVirtualController } from '../controller/fake-virtual-controller.js';
import { connectionDecision } from '../network/local-network.js';
import { PairingService } from '../pairing/pairing-service.js';
import { loadDistributionConfig } from './distribution-config.js';
import { servePhone } from './static-phone.js';
import { StructuredLogger } from './structured-logger.js';
import { userIssue, connectionHelp, pairingRejected } from './user-errors.js';
import { readVJoyDevice } from './vjoy-device-file.js';
import type { VirtualDeviceInfo } from '../controller/virtual-controller.js';
import { PRODUCT_VERSION } from '../../../shared/src/product-version.js';
const dataDirectory = process.env['FPV_DATA_DIR'] ?? join(process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'), 'FPVPhoneController');
const logger = new StructuredLogger(dataDirectory, PRODUCT_VERSION);
async function main(): Promise<void> {
  logger.write('startup', { platform: process.platform, arch: process.arch });
  const directory = dirname(process.argv[1]);
  const distribution = loadDistributionConfig(directory);
  const pairing = new PairingService(), addresses = pairing.getAddresses();
  const port = loadConfig().websocketPort;
  const selected = addresses.find(entry => entry.address === process.env['FPV_BIND_ADDRESS']) ?? addresses[0];
  const token = randomBytes(24).toString('hex');
  const endpoints = addresses.map(entry => ({ name: entry.name, address: entry.address, endpoint: 'ws://' + entry.address + ':' + port + '/?token=' + token }));
  const health = { driver: 'Checking', device: 'Checking', websocket: 'Checking', port: 'Checking', network: selected ? 'Ready' : 'Not available', qr: 'Checking' };
  const state = { type: 'status', version: distribution.version, virtualController: 'NOT AVAILABLE',
    websocket: 'STOPPED', phone: 'DISCONNECTED', port, addresses: endpoints, health,
    selectedAddress: selected?.address ?? '', pwaUrl: distribution.pwaUrl,
    localWebUrl: selected ? 'http://' + selected.address + ':' + port : '',
    logsDirectory: logger.directory, pairingUrl: '', qrPngBase64: '', issueCode: '', message: '',
    device: null as VirtualDeviceInfo | null,
    /** PHONE_ATTEMPTED: some device reached the server since startup (so the firewall is not blocking it). */
    phoneAttempted: false };
  const emit = (): void => {
    if (!logger.available && !state.message) state.message = 'Logs could not be saved. Check disk space and app permissions.';
    process.stdout.write(JSON.stringify(state) + '\n');
  };
  const log = (line: string): void => {
    // Periodic axis diagnostics stay out of the persisted logs.
    if (/THR |RAW |CALIBRATED |Client connected:|Client disconnected:/.test(line)) return;
    if (line.startsWith('Virtual controller:')) {
      health.driver = health.device = 'Ready'; logger.write('driver_ready'); emit();
    } else if (line.startsWith('Virtual controller error:')) {
      const issue = userIssue(line);
      logger.write('controller_error', { detail: line, code: issue.code }, 'error');
      health.device = health.websocket = 'Not available';
      state.virtualController = 'NOT AVAILABLE'; state.websocket = 'STOPPED'; state.phone = 'DISCONNECTED'; state.device = null;
      state.issueCode = issue.code; state.message = issue.message; emit();
    } else if (line === 'FAILSAFE ACTIVE') {
      logger.write('failsafe'); state.message = 'Failsafe active. Controls were reset. Lower throttle before reconnecting.'; emit();
    } else if (/^(WebSocket error:|Shutdown error:)/.test(line)) logger.write('runtime_error', { detail: line }, 'error');
  };
  emit();
  if (!selected) {
    health.driver = health.device = health.websocket = health.port = health.qr = 'Not checked';
    state.issueCode = 'NETWORK_MISSING'; state.message = 'No local network found. Connect Wi-Fi, Ethernet or USB tethering, then Retry.';
    logger.write('network_missing', {}, 'error'); emit(); return;
  }
  logger.write('network_selected', { ip: selected.address, port });
  const loaded = loadConfig();
  // VJOY_DEVICE_ID (developer override) wins over the device chosen by the installer or Repair driver.
  const deviceId = process.env['VJOY_DEVICE_ID'] ? loaded.controller.deviceId : readVJoyDevice(dataDirectory) ?? loaded.controller.deviceId;
  const config = { ...loaded, websocketHost: selected.address, controller: { ...loaded.controller, deviceId } };
  const origin = 'http://' + selected.address + ':' + port;
  const origins = [origin, ...(distribution.pwaUrl ? [new URL(distribution.pwaUrl).origin] : [])];
  const http = createServer(servePhone(join(directory, 'phone')));
  const driver = process.argv.includes('--smoke-test') ? new FakeVirtualController() : new VJoyController(config.controller.deviceId, config.controller.dllPath);
  let companion: Awaited<ReturnType<typeof startCompanion>>, phase = 'qr', lastRejectionLog = 0;
  // Live data for the window, separate from the (large) status line: packets/s and calibrated axes at ~15 Hz.
  const emitMetrics = (): void => {
    if (!companion) return;
    process.stdout.write(JSON.stringify({ type: 'metrics', ...companion.metrics() }) + '\n');
  };
  try {
    const invitation = await pairing.create(distribution.pwaUrl || origin, selected.address, port, token);
    health.qr = 'Ready'; logger.write('qr_generated'); phase = 'companion';
    companion = await startCompanion(config, driver, log, {
      httpServer: http,
      authorize: (peer, requestOrigin, url) => connectionDecision(peer, requestOrigin, url, selected, origins, token),
      onConnectionAttempt: accepted => {
        const first = !state.phoneAttempted; state.phoneAttempted = true;
        if (first) logger.write('phone_attempted', { accepted });
        if (accepted || state.phone === 'CONNECTED') { if (first) emit(); return; }
        const now = Date.now();
        if (now - lastRejectionLog > 10000) { lastRejectionLog = now; logger.write('pairing_rejected', {}, 'warn'); }
        if (state.issueCode !== 'PAIRING_REJECTED') { state.issueCode = 'PAIRING_REJECTED'; state.message = pairingRejected; emit(); }
        else if (first) emit();
      },
      onPhoneStatus: connected => {
        state.phone = connected ? 'CONNECTED' : 'DISCONNECTED'; state.issueCode = connected ? '' : 'PHONE_LOST';
        state.message = connected ? '' : 'Phone connection lost. Check the network and tap Retry on your phone.';
        logger.write(connected ? 'phone_connected' : 'phone_disconnected'); emit();
        if (!connected) emitMetrics();
      }
    });
    state.pairingUrl = invitation.url; state.qrPngBase64 = invitation.qrPngBase64;
    state.device = driver.device ?? null;
    state.virtualController = 'READY'; state.websocket = 'LISTENING'; health.websocket = health.port = 'Ready';
    logger.write('server_started', { ip: selected.address, port }); emit();
  } catch (error) {
    const issue = phase === 'qr' ? { code: 'QR_FAILED', message: 'QR could not be generated. Retry; if it persists, open the logs folder.' } : userIssue(error);
    state.issueCode = issue.code; state.message = issue.message;
    if (phase === 'qr') health.qr = 'Not available';
    else if (issue.code === 'PORT_BUSY' || issue.code === 'NETWORK_PERMISSION') {
      health.websocket = health.port = 'Not available'; health.device = 'Released';
    } else {
      if (issue.code === 'DRIVER_MISSING' || issue.code === 'DRIVER_MISMATCH') health.driver = 'Not available';
      if (issue.code === 'DEVICE_BUSY' || issue.code === 'DEVICE_UNAVAILABLE') health.driver = 'Ready';
      health.device = 'Not available'; health.websocket = health.port = 'Not checked';
    }
    logger.write('startup_error', { code: issue.code, detail: error instanceof Error ? error.stack ?? error.message : String(error) }, 'error');
    emit(); return;
  }
  const waiting = setTimeout(() => {
    if (state.phone === 'DISCONNECTED' && !state.message) {
      state.issueCode = 'CONNECTION_HELP'; state.message = connectionHelp; logger.write('connection_help_shown'); emit();
    }
  }, 45000); waiting.unref();
  const metricsTimer = setInterval(() => { if (state.phone === 'CONNECTED') emitMetrics(); }, 66); metricsTimer.unref();
  let closing = false;
  async function shutdown(): Promise<void> {
    if (closing) return; closing = true; clearTimeout(waiting); clearInterval(metricsTimer);
    try { await companion.shutdown(); } catch (error) { logger.write('shutdown_error', { detail: String(error) }, 'error'); }
    state.websocket = 'STOPPED'; state.virtualController = 'NOT AVAILABLE'; state.phone = 'DISCONNECTED';
    health.websocket = 'Stopped'; health.device = 'Released'; state.device = null; logger.write('shutdown'); emit(); process.exit();
  }
  const input = createInterface({ input: process.stdin });
  input.on('line', line => {
    if (line === 'shutdown') void shutdown();
    // Closes with 4001 so the phone shows "disconnected from PC" and does not reconnect.
    else if (line === 'disconnect-phone') logger.write('phone_disconnect_requested', { closed: companion.disconnectPhone() });
  });
  input.on('close', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); }); process.once('SIGTERM', () => { void shutdown(); });
}
void main().catch(error => {
  logger.write('fatal', { detail: error instanceof Error ? error.stack ?? error.message : String(error) }, 'error');
  process.stdout.write(JSON.stringify({ type: 'fatal', message: userIssue(error).message }) + '\n'); process.exitCode = 1;
});
