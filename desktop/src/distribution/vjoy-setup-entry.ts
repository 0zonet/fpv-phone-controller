/**
 * Bundled as vjoy-setup.cjs and run with runtime\companion-engine.exe:
 *   vjoy-setup.cjs --probe  --state-dir <dir>                       (installer, no admin)
 *   vjoy-setup.cjs --repair --install if-needed --state-dir <dir>   (installer, elevated)
 *   vjoy-setup.cjs --repair --install always --state-dir <dir>      (Repair driver, elevated)
 * The exit code is one of SetupExit. The state dir is passed explicitly because an elevated
 * process may run as another account (over-the-shoulder UAC) with a different %LOCALAPPDATA%.
 */
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { PRODUCT_VERSION } from '../../../shared/src/product-version.js';
import { axisUsage, findVJoyDll } from '../drivers/vjoy/vjoy-controller.js';
import { loadVJoyNative } from '../drivers/vjoy/vjoy-native.js';
import { runVJoySetup, SetupExit, VJOY_INSTALLER_ARGS, VJOY_SETUP_FILE, type DriverProbe } from '../drivers/vjoy/vjoy-setup.js';
import { StructuredLogger } from './structured-logger.js';
import { readVJoyDevice, writeVJoyDevice } from './vjoy-device-file.js';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const stateDirectory = option('--state-dir') ?? join(process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local'), 'FPVPhoneController');
const logger = new StructuredLogger(stateDirectory, PRODUCT_VERSION);
const run = (file: string, parameters: readonly string[], timeout: number): Promise<number> => new Promise(resolve => {
  execFile(file, parameters, { windowsHide: true, timeout }, error => {
    resolve(error ? (typeof error.code === 'number' ? error.code : -1) : 0);
  });
});
function openDriver(): DriverProbe | undefined {
  try {
    const native = loadVJoyNative(findVJoyDll());
    return {
      enabled: native.enabled, matches: native.matches, driverVersion: () => native.versions().driver,
      exists: native.exists,
      fits: id => native.exists(id) && native.buttonCount(id) >= 8 && Object.values(axisUsage).every(axis => native.axisExists(id, axis)),
      close: native.unload
    };
  } catch { return undefined; }
}
const configTool = (): string => join(dirname(findVJoyDll()), 'vJoyConfig.exe');
async function main(): Promise<number> {
  const mode = args.includes('--repair') ? 'repair' : 'probe';
  const install = option('--install') === 'always' ? 'always' : 'if-needed';
  logger.write('vjoy_setup_start', { mode, install });
  return runVJoySetup(mode, install, {
    openDriver,
    runInstaller: () => run(join(dirname(process.argv[1]), 'vjoy', VJOY_SETUP_FILE), VJOY_INSTALLER_ARGS, 10 * 60000),
    runConfig: parameters => run(configTool(), parameters, 60000),
    readPreferred: () => readVJoyDevice(stateDirectory),
    save: id => writeVJoyDevice(stateDirectory, id),
    log: (event, details) => logger.write(event, details),
    wait: ms => new Promise(resolve => setTimeout(resolve, ms))
  });
}
main().then(code => { logger.write('vjoy_setup_result', { code }); process.exit(code); }, error => {
  logger.write('vjoy_setup_error', { detail: error instanceof Error ? error.stack ?? error.message : String(error) }, 'error');
  process.exit(SetupExit.DRIVER_FAILED);
});
