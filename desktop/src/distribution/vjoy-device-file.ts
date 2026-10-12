import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
/** Written by vjoy-setup (installer or Repair driver), read by the companion at startup. */
export const VJOY_DEVICE_FILE = 'vjoy-device.json';
export function readVJoyDevice(dataDirectory: string): number | undefined {
  try {
    const id = (JSON.parse(readFileSync(join(dataDirectory, VJOY_DEVICE_FILE), 'utf8')) as { deviceId?: unknown }).deviceId;
    return Number.isInteger(id) && (id as number) >= 1 && (id as number) <= 16 ? id as number : undefined;
  } catch { return undefined; }
}
export function writeVJoyDevice(dataDirectory: string, deviceId: number): void {
  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(join(dataDirectory, VJOY_DEVICE_FILE), JSON.stringify({ deviceId, updatedAt: new Date().toISOString() }) + '\n', 'utf8');
}
