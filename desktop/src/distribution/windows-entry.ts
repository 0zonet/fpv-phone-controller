import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { loadConfig } from '../config.js';
import { startCompanion } from '../companion.js';
import { VJoyController } from '../drivers/vjoy/vjoy-controller.js';
import { FakeVirtualController } from '../controller/fake-virtual-controller.js';
import { authorizedConnection } from '../network/local-network.js';
import { PairingService } from '../pairing/pairing-service.js';
import { loadDistributionConfig } from './distribution-config.js';
import { servePhone } from './static-phone.js';

async function main(): Promise<void> {
  const directory = dirname(process.argv[1]);
  const distribution = loadDistributionConfig(directory);
  const pairing = new PairingService();
  const addresses = pairing.getAddresses();
  const port = loadConfig().websocketPort;
  const selected = addresses.find(entry => entry.address === process.env['FPV_BIND_ADDRESS']) ?? addresses[0];
  const token = randomBytes(24).toString('hex');
  const endpoints = addresses.map(entry => ({ name: entry.name, address: entry.address,
    endpoint: 'ws://' + entry.address + ':' + port + '/?token=' + token }));
  const state = { type: 'status', version: distribution.version, virtualController: 'NOT AVAILABLE',
    websocket: 'STOPPED', phone: 'DISCONNECTED', port, addresses: endpoints,
    selectedAddress: selected?.address ?? '', pwaUrl: distribution.pwaUrl,
    localWebUrl: selected ? 'http://' + selected.address + ':' + port : '',
    pairingUrl: '', qrPngBase64: '', message: '' };
  const emit = (): void => { process.stdout.write(JSON.stringify(state) + '\n'); };
  const log = (line: string): void => {
    if (line.startsWith('Virtual controller error:')) {
      state.virtualController = 'NOT AVAILABLE'; state.websocket = 'STOPPED';
      state.phone = 'DISCONNECTED'; state.message = line; emit();
    } else if (line === 'FAILSAFE ACTIVE') { state.message = line; emit(); }
  };
  emit();
  if (!selected) {
    state.message = 'No local network found. Connect Wi-Fi, Ethernet or USB tethering, then Retry.';
    emit(); return;
  }
  const config = { ...loadConfig(), websocketHost: selected.address };
  const origin = 'http://' + selected.address + ':' + port;
  const origins = [origin, ...(distribution.pwaUrl ? [new URL(distribution.pwaUrl).origin] : [])];
  const http = createServer(servePhone(join(directory, 'phone')));
  const driver = process.argv.includes('--smoke-test') ? new FakeVirtualController()
    : new VJoyController(config.controller.deviceId, config.controller.dllPath);
  let companion: Awaited<ReturnType<typeof startCompanion>>;
  try {
    const invitation = await pairing.create(distribution.pwaUrl || origin, selected.address, port, token);
    companion = await startCompanion(config, driver, log, {
      httpServer: http,
      authorize: (peer, requestOrigin, url) => authorizedConnection(peer, requestOrigin, url, selected, origins, token),
      onPhoneStatus: connected => {
        state.phone = connected ? 'CONNECTED' : 'DISCONNECTED';
        if (state.websocket !== 'STOPPED') state.message = '';
        emit();
      }
    });
    state.pairingUrl = invitation.url; state.qrPngBase64 = invitation.qrPngBase64;
    state.virtualController = 'READY'; state.websocket = 'LISTENING'; emit();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    state.message = /not found|not installed|cannot load|missing/i.test(detail)
      ? 'Virtual joystick driver not installed or unavailable. ' + detail : detail;
    emit(); return;
  }
  let closing = false;
  async function shutdown(): Promise<void> {
    if (closing) return; closing = true;
    try { await companion.shutdown(); }
    catch (error) { process.stderr.write(String(error) + '\n'); }
    state.websocket = 'STOPPED'; state.virtualController = 'NOT AVAILABLE'; state.phone = 'DISCONNECTED'; emit();
    process.exit();
  }
  const input = createInterface({ input: process.stdin });
  input.on('line', line => { if (line === 'shutdown') void shutdown(); });
  input.on('close', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}
void main().catch(error => {
  process.stdout.write(JSON.stringify({ type: 'fatal', message: String(error) }) + '\n');
  process.exitCode = 1;
});
