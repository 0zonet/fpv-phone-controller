import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ButtonInteraction } from './button-interaction';
test('momentary emits press and release, including release outside', () => {
  const values: boolean[] = []; const button = new ButtonInteraction(value => values.push(value));
  button.press(1, 'momentary', false); button.release(1, true, false);
  assert.deepEqual(values, [true, false]);
});
test('pointer cancellation and lost capture release once; other touches cannot interfere', () => {
  const values: boolean[] = []; const button = new ButtonInteraction(value => values.push(value));
  button.press(1, 'momentary', false); button.press(2, 'momentary', false);
  button.release(2, true); button.cancel(2); assert.deepEqual(values, [true]);
  button.cancel(1); button.cancel(1); button.release(1, true); assert.deepEqual(values, [true, false]);
});
test('toggle alternates on completed taps and cancellation never toggles', () => {
  let value = false; const button = new ButtonInteraction(next => { value = next; });
  button.press(1, 'toggle', false); assert.equal(value, false); button.release(1, value); assert.equal(value, true);
  button.press(2, 'toggle', false); button.release(2, value); assert.equal(value, false);
  button.press(3, 'toggle', false); button.cancel(); button.release(3, value); assert.equal(value, false);
  button.press(4, 'toggle', false); button.release(4, value, false); assert.equal(value, false);
});
test('disabled buttons emit nothing; independent instances support simultaneous touches', () => {
  const a: boolean[] = [], b: boolean[] = [];
  const left = new ButtonInteraction(v => a.push(v)), right = new ButtonInteraction(v => b.push(v));
  left.press(0, 'toggle', true); left.release(0, false); assert.deepEqual(a, []);
  left.press(1, 'momentary', false); right.press(2, 'momentary', false);
  left.release(1, true); assert.deepEqual(a, [true, false]); assert.deepEqual(b, [true]);
  right.cancel(); assert.deepEqual(b, [true, false]);
});
