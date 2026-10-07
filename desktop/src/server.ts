import { networkInterfaces } from 'node:os';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { VJoyController } from './drivers/vjoy/vjoy-controller.js';
import { startCompanion } from './companion.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const driver = new VJoyController(config.controller.deviceId, config.controller.dllPath);
  const companion = await startCompanion(config, driver);
  for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) {
    if (entry.family === 'IPv4' && !entry.internal) {
      console.log('Phone web: http://' + entry.address + ':4200 | WebSocket: ws://' + entry.address + ':' + config.websocketPort);
    }
  }
  const shutdown = () => {
    void companion.shutdown().catch(error => { console.error(String(error)); process.exitCode = 1; });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => { console.error('Companion startup failed: ' + String(error)); process.exitCode = 1; });
}
