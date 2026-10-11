import { CONTROLLER_BUTTON_COUNT, normalizeButtons } from '../../../../shared/src/index.js';
/** Driver boundary: generic index 0 maps to native button 1. */
export function writeVJoyButtons(buttons: readonly boolean[], deviceId: number,
  write: (pressed: boolean, deviceId: number, button: number) => boolean): void {
  const failures: number[] = [];
  normalizeButtons(buttons).forEach((pressed, index) => {
    if (!write(pressed, deviceId, index + 1)) failures.push(index + 1);
  });
  if (failures.length) throw new Error('vJoy button update failed: ' + failures.join(', '));
}
export function requireVJoyButtons(count: number): void {
  if (!Number.isInteger(count) || count < CONTROLLER_BUTTON_COUNT)
    throw new Error('vJoy buttons are missing. Enable at least 8 buttons in Configure vJoy, then Retry.');
}
