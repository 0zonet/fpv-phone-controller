import { CONTROLLER_BUTTON_COUNT, normalizeButtons } from '../../../../shared/src/index.js';
/** Driver boundary: generic index 0 maps to native button 1; buttons above `available` are ignored. */
export function writeVJoyButtons(buttons: readonly boolean[], deviceId: number,
  write: (pressed: boolean, deviceId: number, button: number) => boolean, available = CONTROLLER_BUTTON_COUNT): void {
  const failures: number[] = [];
  normalizeButtons(buttons).slice(0, usableVJoyButtons(available)).forEach((pressed, index) => {
    if (!write(pressed, deviceId, index + 1)) failures.push(index + 1);
  });
  if (failures.length) throw new Error('vJoy button update failed: ' + failures.join(', '));
}
/** Number of generic buttons a device with `count` native buttons can receive: min(count, 8). */
export function usableVJoyButtons(count: number): number {
  return Number.isInteger(count) && count > 0 ? Math.min(count, CONTROLLER_BUTTON_COUNT) : 0;
}
