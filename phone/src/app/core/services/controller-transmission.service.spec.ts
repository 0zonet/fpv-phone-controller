import { neutralButtons } from '../../../../../shared/src/index';
import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerStateService } from './controller-state.service';
import { syncTransmission } from './controller-transmission.service';

test('buttons start OFF on load and on every connection, reconnection and disconnection', () => {
  const state = new ControllerStateService();
  const calls: string[] = [];
  const loop = { start: () => { calls.push('start:' + state.buttons().some(Boolean)); }, stop: () => { calls.push('stop'); } };
  assert.deepEqual(state.buttons(), neutralButtons());
  state.setButton(0, true); state.setButton(2, true);
  syncTransmission(true, loop, state);
  assert.deepEqual(state.buttons(), neutralButtons());
  state.setButton(1, true);
  syncTransmission(false, loop, state);
  assert.deepEqual(state.buttons(), neutralButtons());
  state.setButton(3, true);
  syncTransmission(true, loop, state);
  assert.deepEqual(state.buttons(), neutralButtons());
  // The loop never starts sending while any button is still ON.
  assert.deepEqual(calls, ['start:false', 'stop', 'start:false']);
});
