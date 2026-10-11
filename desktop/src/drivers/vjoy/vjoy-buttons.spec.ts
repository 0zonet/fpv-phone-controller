import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireVJoyButtons, writeVJoyButtons } from './vjoy-buttons.js';
test('maps every generic index 0..7 to native buttons 1..8 on the same device', () => {
  for (let active = 0; active < 8; active++) {
    const writes: { pressed: boolean; deviceId: number; button: number }[] = [];
    writeVJoyButtons(Array.from({ length: 8 }, (_, i) => i === active), 3,
      (pressed, deviceId, button) => { writes.push({ pressed, deviceId, button }); return true; });
    assert.deepEqual(writes, Array.from({ length: 8 }, (_, i) => ({ pressed: i === active, deviceId: 3, button: i + 1 })));
  }
});
test('short arrays release unspecified buttons and failed writes still attempt all releases', () => {
  const writes: boolean[] = [];
  writeVJoyButtons([true], 1, pressed => { writes.push(pressed); return true; });
  assert.deepEqual(writes, [true, false, false, false, false, false, false, false]);
  const attempted: number[] = [];
  assert.throws(() => writeVJoyButtons([], 1, (_, __, button) => { attempted.push(button); return button !== 2; }), /update failed: 2/);
  assert.deepEqual(attempted, [1, 2, 3, 4, 5, 6, 7, 8]);
});
test('requires eight configured buttons with actionable error before acquisition', () => {
  for (const count of [0, 4, 7, NaN]) assert.throws(() => requireVJoyButtons(count), /Enable at least 8 buttons/);
  requireVJoyButtons(8); requireVJoyButtons(128);
});
