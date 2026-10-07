import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { VirtualController } from '../../controller/virtual-controller.js';
import { safeAxes, type VirtualControllerAxes } from '../../controller/virtual-controller.types.js';
import { loadVJoyNative } from './vjoy-native.js';

const axisUsage = { roll: 0x30, pitch: 0x31, yaw: 0x32, throttle: 0x36 } as const;
interface AxisRange { readonly min: number; readonly max: number; }

export class VJoyController implements VirtualController {
  private native: ReturnType<typeof loadVJoyNative> | undefined;
  private connected = false;
  private readonly ranges = new Map<keyof VirtualControllerAxes, AxisRange>();
  constructor(private readonly deviceId: number, private readonly dllPath?: string) {}
  async connect(): Promise<void> {
    if (this.connected) return;
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('vJoy requires Windows x64 and Node.js x64.');
    if (!Number.isInteger(this.deviceId) || this.deviceId < 1 || this.deviceId > 16) throw new Error('vJoy deviceId must be 1..16.');
    const path = this.findDll();
    try { this.native = loadVJoyNative(path); }
    catch (error) { throw new Error('Cannot load vJoyInterface.dll. Use the x64 DLL matching the installed driver. ' + String(error)); }
    let acquired = false;
    try {
      const native = this.native;
      if (!native.enabled()) throw new Error('vJoy is not installed, disabled or unavailable. Install the signed BRUNNER release manually.');
      if (!native.matches()) throw new Error('vJoy driver and SDK DLL versions do not match. Use the DLL supplied with the installed release.');
      if (!native.exists(this.deviceId)) throw new Error('vJoy device ' + this.deviceId + ' is missing. Enable it in Configure vJoy.');
      if (native.status(this.deviceId) !== 1) throw new Error('vJoy device ' + this.deviceId + ' is not free. Close other feeders or choose another device ID.');
      for (const axis of Object.keys(axisUsage) as (keyof typeof axisUsage)[]) {
        if (!native.axisExists(this.deviceId, axisUsage[axis])) throw new Error('vJoy axis ' + axis + ' is missing. Enable X, Y, Z and Slider in Configure vJoy.');
        this.ranges.set(axis, native.range(this.deviceId, axisUsage[axis]));
      }
      if (!native.acquire(this.deviceId)) throw new Error('Could not acquire vJoy device ' + this.deviceId + '.');
      acquired = true; this.connected = true; this.reset();
    } catch (error) {
      this.connected = false;
      try { if (acquired) this.native.relinquish(this.deviceId); }
      finally { this.native.unload(); this.native = undefined; this.ranges.clear(); }
      throw error;
    }
  }
  updateAxes(axes: VirtualControllerAxes): void {
    if (!this.connected || !this.native) throw new Error('vJoy is not connected.');
    const failures: string[] = [];
    for (const axis of Object.keys(axisUsage) as (keyof typeof axisUsage)[]) {
      const range = this.ranges.get(axis);
      if (!range) throw new Error('vJoy axis range is unavailable.');
      const input = Number.isFinite(axes[axis]) ? axes[axis] : 0;
      const unit = axis === 'throttle' ? Math.max(0, Math.min(1, input)) : (Math.max(-1, Math.min(1, input)) + 1) / 2;
      const value = Math.round(range.min + unit * (range.max - range.min));
      if (!this.native.setAxis(value, this.deviceId, axisUsage[axis])) failures.push(axis);
    }
    if (failures.length) throw new Error('vJoy axis update failed (' + failures.join(', ') + '); device may have been removed.');
  }
  reset(): void { this.updateAxes(safeAxes()); }
  async disconnect(): Promise<void> {
    const native = this.native;
    if (!native) return;
    try { if (this.connected) this.reset(); }
    finally {
      try { if (this.connected) native.relinquish(this.deviceId); }
      finally { this.connected = false; this.native = undefined; this.ranges.clear(); native.unload(); }
    }
  }
  private findDll(): string {
    if (this.dllPath) {
      if (!isAbsolute(this.dllPath) || !existsSync(this.dllPath)) throw new Error('VJOY_DLL_PATH must point to an existing absolute x64 vJoyInterface.dll path.');
      return this.dllPath;
    }
    const base = process.env['ProgramW6432'] ?? process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const candidates = [join(base, 'vJoy', 'x64', 'vJoyInterface.dll'), join(base, 'vJoy', 'SDK', 'x64', 'vJoyInterface.dll'), join(base, 'vJoy', 'vJoyInterface.dll')];
    const found = candidates.find(path => existsSync(path));
    if (!found) throw new Error('vJoyInterface.dll not found. Install vJoy 2.2.2.0 manually, then set VJOY_DLL_PATH to its x64 SDK DLL if necessary. See desktop/README.md.');
    return found;
  }
}
