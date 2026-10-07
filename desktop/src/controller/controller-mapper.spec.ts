import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerMapper } from './controller-mapper.js';
import { defaultConfig } from '../config.js';

const state = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
const calibration = {
  throttle: { ...defaultConfig.calibration.throttle },
  yaw: { ...defaultConfig.calibration.yaw, deadzone: 0 },
  pitch: { ...defaultConfig.calibration.pitch, invert: false, deadzone: 0 },
  roll: { ...defaultConfig.calibration.roll, deadzone: 0 }
};
const mapper = new ControllerMapper({ calibration });
test('throttle usa mínimo, mitad y máximo lógico sin rango de driver', () => {
  for (const throttle of [0, .5, 1]) assert.equal(mapper.map({ ...state, throttle }).throttle, throttle);
});
test('cada eje bipolar usa mínimo, centro y máximo lógico', () => {
  for (const axis of ['yaw', 'pitch', 'roll'] as const) {
    for (const value of [-1, 0, 1]) assert.equal(mapper.map({ ...state, [axis]: value })[axis], value);
  }
});
test('clamp protege throttle y los tres ejes, y sanea entradas no finitas', () => {
  assert.deepEqual(mapper.map({ throttle: -4, yaw: -4, pitch: 4, roll: 4 }), { throttle: 0, yaw: -1, pitch: 1, roll: 1 });
  assert.equal(mapper.map({ ...state, throttle: 4 }).throttle, 1);
  assert.deepEqual(mapper.map({ throttle: NaN, yaw: Infinity, pitch: -Infinity, roll: NaN }), state);
});
test('config Windows preserva arriba/izquierda y centra pequeños movimientos', () => {
  const windows = new ControllerMapper({ calibration: defaultConfig.calibration });
  assert.deepEqual(windows.map({ throttle: 1, yaw: .02, pitch: .8, roll: -.3 }),
    { throttle: 1, yaw: 0, pitch: -(.8 - .03) / .97, roll: -(.3 - .03) / .97 });
  assert.equal(windows.map({ ...state, pitch: -1 }).pitch, 1);
  assert.equal(windows.map(state).pitch, 0);
});
