/**
 * Installs (if needed) and configures the vJoy device used by the companion.
 * Never modifies an existing device: it reuses a fitting one or creates the first free ID.
 */
export const VJOY_SETUP_FILE = 'vJoySetup_v2.2.2.0_Win10_Win11.exe';
/** Driver version as reported by DriverMatch (2.2.2.0 → 0x0222). */
export const VJOY_MIN_DRIVER_VERSION = 0x0222;
export const VJOY_INSTALLER_ARGS = ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-'] as const;
export const VJOY_MAX_DEVICES = 16;
/** X, Y, Z, Slider 0 and 8 buttons: what vjoy-controller.ts uses. */
export const vJoyDeviceArgs = (id: number): string[] => [String(id), '-a', 'x', 'y', 'z', 'sl0', '-b', '8'];
export const SetupExit = { READY: 0, NEEDS_ADMIN: 10, DRIVER_FAILED: 20, DEVICE_FAILED: 21, NO_FREE_DEVICE: 22 } as const;
export type SetupMode = 'probe' | 'repair';
export type DriverInstall = 'if-needed' | 'always';

export interface DriverProbe {
  enabled(): boolean;
  matches(): boolean;
  driverVersion(): number;
  exists(id: number): boolean;
  /** Exists with X, Y, Z, Slider 0 and at least 8 buttons. */
  fits(id: number): boolean;
  close(): void;
}
export interface SetupDependencies {
  /** undefined when vJoyInterface.dll is missing or cannot be loaded. */
  openDriver(): DriverProbe | undefined;
  runInstaller(): Promise<number>;
  runConfig(args: string[]): Promise<number>;
  readPreferred(): number | undefined;
  save(id: number): void;
  log(event: string, details?: Record<string, string | number | boolean>): void;
  wait(ms: number): Promise<void>;
}
export type DeviceChoice = { readonly action: 'use' | 'create'; readonly id: number };

/** Saved ID if it still fits, else device 1 if it fits, else the first free ID. */
export function chooseDevice(driver: Pick<DriverProbe, 'exists' | 'fits'>, preferred?: number): DeviceChoice | undefined {
  if (preferred !== undefined && driver.fits(preferred)) return { action: 'use', id: preferred };
  if (driver.fits(1)) return { action: 'use', id: 1 };
  for (let id = 1; id <= VJOY_MAX_DEVICES; id++) if (!driver.exists(id)) return { action: 'create', id };
  return undefined;
}

async function reopen(deps: SetupDependencies, ready: (driver: DriverProbe) => boolean): Promise<DriverProbe | undefined> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const driver = deps.openDriver();
    if (driver && ready(driver)) return driver;
    driver?.close();
    await deps.wait(500);
  }
  return undefined;
}

/**
 * `probe` never needs admin: it saves a fitting device or returns NEEDS_ADMIN.
 * `repair` runs elevated: installs the bundled driver when needed (or always) and creates the device.
 */
export async function runVJoySetup(mode: SetupMode, install: DriverInstall, deps: SetupDependencies): Promise<number> {
  const elevated = mode === 'repair';
  let driver = deps.openDriver();
  try {
    if (driver && !driver.enabled() && elevated && install === 'if-needed') {
      deps.log('vjoy_enable', { code: await deps.runConfig(['enable', 'on']) });
      driver.close(); driver = await reopen(deps, candidate => candidate.enabled());
    }
    const healthy = (candidate: DriverProbe): boolean => candidate.enabled() && candidate.matches()
      && candidate.driverVersion() >= VJOY_MIN_DRIVER_VERSION;
    const usable = driver !== undefined && healthy(driver);
    deps.log('vjoy_setup_check', { mode, install, loaded: driver !== undefined, usable,
      driverVersion: driver ? '0x' + driver.driverVersion().toString(16) : 'none' });
    if (install === 'always' || !usable) {
      if (!elevated) return SetupExit.NEEDS_ADMIN;
      driver?.close(); driver = undefined;
      const code = await deps.runInstaller();
      deps.log('vjoy_installer_exit', { code });
      if (code !== 0) return SetupExit.DRIVER_FAILED;
      driver = await reopen(deps, healthy);
      if (!driver) return SetupExit.DRIVER_FAILED;
    }
    const choice = chooseDevice(driver!, deps.readPreferred());
    if (!choice) { deps.log('vjoy_no_free_device'); return SetupExit.NO_FREE_DEVICE; }
    if (choice.action === 'create') {
      if (!elevated) return SetupExit.NEEDS_ADMIN;
      deps.log('vjoy_device_create', { id: choice.id, code: await deps.runConfig(vJoyDeviceArgs(choice.id)) });
      driver!.close(); driver = await reopen(deps, candidate => candidate.fits(choice.id));
      if (!driver) return SetupExit.DEVICE_FAILED;
    }
    deps.save(choice.id);
    deps.log('vjoy_device_selected', { id: choice.id, created: choice.action === 'create' });
    return SetupExit.READY;
  } finally { driver?.close(); }
}
