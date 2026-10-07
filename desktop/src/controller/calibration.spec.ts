import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerMapper } from './controller-mapper.js';
import { defaultConfig } from '../config.js';

const zero = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
const calibration = { ...defaultConfig.calibration,
  pitch: { ...defaultConfig.calibration.pitch, invert: false } };
const make = (axes = calibration) => new ControllerMapper({ calibration: axes });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12);

test('deadzone central y reescalado conservan centros y extremos de los tres ejes', () => {
  for (const axis of ['yaw', 'pitch', 'roll'] as const) {
    for (const value of [-.03, 0, .03]) assert.equal(make().map({ ...zero, [axis]: value })[axis], 0);
    for (const value of [-1, 1]) assert.equal(make().map({ ...zero, [axis]: value })[axis], value);
    near(make().map({ ...zero, [axis]: .515 })[axis], .5);
    near(make().map({ ...zero, [axis]: -.515 })[axis], -.5);
  }
});
test('extremos asimétricos se normalizan a ambos lados del centro', () => {
  const mapper = make({ ...calibration, yaw: { min: -.8, max: .9, center: .1, invert: false, deadzone: 0 } });
  for (const [input, expected] of [[-.8, -1], [.1, 0], [.9, 1], [-.35, -.5], [.5, .5], [4, 1]]) {
    near(mapper.map({ ...zero, yaw: input! }).yaw, expected!);
  }
});
test('inversión individual combinada con deadzone y extremos', () => {
  for (const axis of ['yaw', 'pitch', 'roll'] as const) {
    const mapper = make({ ...calibration, [axis]: { ...calibration[axis], invert: true } });
    near(mapper.map({ ...zero, [axis]: .515 })[axis], -.5);
    assert.equal(mapper.map({ ...zero, [axis]: .02 })[axis], 0);
    assert.equal(mapper.map({ ...zero, [axis]: -1 })[axis], 1);
    assert.equal(mapper.map({ ...zero, [axis]: 1 })[axis], -1);
  }
});
test('throttle recorre todo el rango e ignora deadzone y center', () => {
  for (const invert of [false, true]) {
    const mapper = make({ ...calibration, throttle: { min: .1, max: .9, center: .4, invert, deadzone: .3 } });
    for (const [input, value] of [[0, 0], [.1, 0], [.5, .5], [.9, 1], [2, 1]]) {
      near(mapper.map({ ...zero, throttle: input! }).throttle, invert ? 1 - value! : value!);
    }
  }
});
test('rechaza calibraciones degeneradas antes de conectar al driver', () => {
  for (const change of [{ min: 1 }, { center: -1 }, { deadzone: 1 }, { max: NaN }]) {
    assert.throws(() => make({ ...calibration, yaw: { ...calibration.yaw, ...change } }));
  }
});
