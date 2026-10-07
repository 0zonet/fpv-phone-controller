import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isControllerMessage } from './controller-message.js';

const message = { type: 'controller-state', sequence: 0, timestamp: 1700000000000, axes: { throttle: .5, yaw: -.2, pitch: .1, roll: .8 } };
test('acepta protocolo y límites de ejes', () => {
  assert.equal(isControllerMessage(message), true);
  assert.equal(isControllerMessage({ ...message, axes: { throttle: 0, yaw: -1, pitch: 1, roll: 0 } }), true);
  assert.equal(isControllerMessage({ ...message, axes: { throttle: 1, yaw: 1, pitch: -1, roll: 1 } }), true);
});
test('rechaza estructura, type, sequence y timestamp inválidos', () => {
  for (const value of [null, [], {}, { ...message, type: 'other' }, { ...message, axes: [] }, { ...message, axes: null }]) {
    assert.equal(isControllerMessage(value), false);
  }
  for (const sequence of [-1, .5, '1', Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isControllerMessage({ ...message, sequence }), false);
  }
  for (const timestamp of [-1, '1000', Infinity, NaN, undefined]) {
    assert.equal(isControllerMessage({ ...message, timestamp }), false);
  }
});
test('rechaza cada eje fuera de rango, ausente o no numérico', () => {
  for (const axis of ['throttle', 'yaw', 'pitch', 'roll']) {
    for (const value of [-2, 2, '0', Infinity, NaN, undefined]) {
      assert.equal(isControllerMessage({ ...message, axes: { ...message.axes, [axis]: value } }), false);
    }
  }
  assert.equal(isControllerMessage({ ...message, axes: { ...message.axes, throttle: -.01 } }), false);
});
