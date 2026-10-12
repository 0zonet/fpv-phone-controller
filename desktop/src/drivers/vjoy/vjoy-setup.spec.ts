import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseDevice, runVJoySetup, SetupExit, vJoyDeviceArgs, type DriverProbe, type SetupDependencies } from './vjoy-setup.js';

interface FakeSystem {
  installed: boolean; enabled: boolean; version: number; matches: boolean;
  devices: Map<number, boolean>; preferred?: number;
}
function harness(system: FakeSystem, options: { installerCode?: number; installerVersion?: number; configCreates?: boolean } = {}) {
  const calls: string[] = [];
  let saved: number | undefined;
  const deps: SetupDependencies = {
    openDriver: () => system.installed ? {
      enabled: () => system.enabled, matches: () => system.matches, driverVersion: () => system.version,
      exists: id => system.devices.has(id), fits: id => system.devices.get(id) === true, close: () => {}
    } satisfies DriverProbe : undefined,
    runInstaller: async () => {
      calls.push('install');
      if ((options.installerCode ?? 0) === 0) {
        system.installed = system.enabled = system.matches = true; system.version = options.installerVersion ?? 0x0222;
        if (!system.devices.size) system.devices.set(1, true);
      }
      return options.installerCode ?? 0;
    },
    runConfig: async args => {
      calls.push('config ' + args.join(' '));
      if (args[0] === 'enable') system.enabled = true;
      else if (options.configCreates !== false) system.devices.set(Number(args[0]), true);
      return 0;
    },
    readPreferred: () => system.preferred,
    save: id => { saved = id; },
    log: () => {},
    wait: async () => {}
  };
  return { deps, calls, saved: () => saved };
}
const fresh = (): FakeSystem => ({ installed: false, enabled: false, version: 0, matches: false, devices: new Map() });
const ready = (devices: [number, boolean][]): FakeSystem => ({ installed: true, enabled: true, version: 0x0222, matches: true, devices: new Map(devices) });

test('chooses saved device, then device 1, then the first free ID', () => {
  const probe = (devices: [number, boolean][]) => ({ exists: (id: number) => new Map(devices).has(id), fits: (id: number) => new Map(devices).get(id) === true });
  assert.deepEqual(chooseDevice(probe([[1, true]])), { action: 'use', id: 1 });
  assert.deepEqual(chooseDevice(probe([[1, true], [3, true]]), 3), { action: 'use', id: 3 });
  assert.deepEqual(chooseDevice(probe([[1, true]]), 3), { action: 'use', id: 1 });
  assert.deepEqual(chooseDevice(probe([])), { action: 'create', id: 1 });
  assert.deepEqual(chooseDevice(probe([[1, false], [2, false], [4, true]])), { action: 'create', id: 3 });
  assert.equal(chooseDevice(probe(Array.from({ length: 16 }, (_, i) => [i + 1, false] as [number, boolean]))), undefined);
});
test('probe without vJoy asks for admin and never installs', async () => {
  const { deps, calls } = harness(fresh());
  assert.equal(await runVJoySetup('probe', 'if-needed', deps), SetupExit.NEEDS_ADMIN);
  assert.deepEqual(calls, []);
});
test('probe with a compatible vJoy and fitting device 1 saves it without admin', async () => {
  const { deps, calls, saved } = harness(ready([[1, true]]));
  assert.equal(await runVJoySetup('probe', 'if-needed', deps), SetupExit.READY);
  assert.equal(saved(), 1); assert.deepEqual(calls, []);
});
test('probe with an old driver or a mismatched DLL asks for admin', async () => {
  for (const change of [{ version: 0x0219 }, { matches: false }, { enabled: false }]) {
    const { deps } = harness({ ...ready([[1, true]]), ...change });
    assert.equal(await runVJoySetup('probe', 'if-needed', deps), SetupExit.NEEDS_ADMIN);
  }
});
test('probe with device 1 used for something else asks for admin to create another', async () => {
  const { deps, calls } = harness(ready([[1, false]]));
  assert.equal(await runVJoySetup('probe', 'if-needed', deps), SetupExit.NEEDS_ADMIN);
  assert.deepEqual(calls, []);
});
test('repair on a clean PC installs vJoy once and uses its default device 1', async () => {
  const { deps, calls, saved } = harness(fresh());
  assert.equal(await runVJoySetup('repair', 'if-needed', deps), SetupExit.READY);
  assert.deepEqual(calls, ['install']); assert.equal(saved(), 1);
});
test('repair keeps an occupied device 1 untouched and creates the first free ID', async () => {
  const system = ready([[1, false], [2, false]]);
  const { deps, calls, saved } = harness(system);
  assert.equal(await runVJoySetup('repair', 'if-needed', deps), SetupExit.READY);
  assert.deepEqual(calls, ['config ' + vJoyDeviceArgs(3).join(' ')]);
  assert.equal(saved(), 3); assert.equal(system.devices.get(1), false); assert.equal(system.devices.get(2), false);
  assert.ok(!vJoyDeviceArgs(3).includes('-f'), 'never forces over an existing device');
});
test('repair button reinstalls even when vJoy looks healthy', async () => {
  const { deps, calls } = harness(ready([[1, true]]));
  assert.equal(await runVJoySetup('repair', 'always', deps), SetupExit.READY);
  assert.deepEqual(calls, ['install']);
});
test('repair enables a disabled driver instead of reinstalling it', async () => {
  const { deps, calls } = harness({ ...ready([[1, true]]), enabled: false });
  assert.equal(await runVJoySetup('repair', 'if-needed', deps), SetupExit.READY);
  assert.deepEqual(calls, ['config enable on']);
});
test('repair reports installer and device failures with distinct exit codes', async () => {
  assert.equal(await runVJoySetup('repair', 'if-needed', harness(fresh(), { installerCode: 5 }).deps), SetupExit.DRIVER_FAILED);
  assert.equal(await runVJoySetup('repair', 'if-needed', harness(fresh(), { installerVersion: 0x0219 }).deps), SetupExit.DRIVER_FAILED);
  assert.equal(await runVJoySetup('repair', 'if-needed', harness(ready([[1, false]]), { configCreates: false }).deps), SetupExit.DEVICE_FAILED);
  const full = ready(Array.from({ length: 16 }, (_, i) => [i + 1, false] as [number, boolean]));
  assert.equal(await runVJoySetup('repair', 'if-needed', harness(full).deps), SetupExit.NO_FREE_DEVICE);
});
