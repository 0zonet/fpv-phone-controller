import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerStateService } from './controller-state.service';
import { releaseValue } from '../../features/controller/utils/stick-math';

test('inicia radio Mode 2 en reposo y throttle mínimo', () => {
  const service = new ControllerStateService();
  assert.deepEqual(service.state(), { throttle: 0, yaw: 0, pitch: 0, roll: 0 });
  assert.deepEqual(service.leftStick(), { x: 0, y: -1 });
  assert.deepEqual(service.rightStick(), { x: 0, y: 0 });
  assert.equal('set' in service.state, false);
  assert.equal('set' in service.throttle, false);
});
test('mutaciones explícitas actualizan signals y computed sin alterar el otro stick', () => {
  const service = new ControllerStateService();
  service.setLeftStick({ x: -.3, y: .4 });
  service.setRightStick({ x: .6, y: -.2 });
  assert.equal(service.throttle(), .7); assert.equal(service.yaw(), -.3);
  assert.equal(service.roll(), .6); assert.equal(service.pitch(), -.2);
  assert.deepEqual(service.state(), { throttle: .7, yaw: -.3, pitch: -.2, roll: .6 });
});
test('rangos quedan protegidos incluso ante entradas fuera del componente', () => {
  const service = new ControllerStateService();
  service.setLeftStick({ x: -20, y: 20 });
  service.setRightStick({ x: 20, y: -20 });
  assert.deepEqual(service.state(), { throttle: 1, yaw: -1, pitch: -1, roll: 1 });
  service.setLeftStick({ x: NaN, y: Infinity });
  service.setRightStick({ x: Infinity, y: NaN });
  assert.deepEqual(service.state(), { throttle: 0, yaw: 0, pitch: 0, roll: 0 });
});
test('conversión de throttle cubre mínimo, centro y máximo', () => {
  const service = new ControllerStateService();
  for (const [y, expected] of [[-1, 0], [0, .5], [1, 1]]) {
    service.setLeftStick({ x: 0, y });
    assert.equal(service.throttle(), expected);
    assert.equal(service.leftStick().y, y);
  }
});
test('políticas de release preservan throttle y autocentran yaw, roll y pitch', () => {
  const service = new ControllerStateService();
  service.setLeftStick({ x: .2, y: .6 });
  service.setRightStick({ x: -.5, y: .4 });
  service.setLeftStick(releaseValue(service.leftStick(), { x: true, y: false }));
  service.setRightStick(releaseValue(service.rightStick(), { x: true, y: true }));
  assert.deepEqual(service.state(), { throttle: .8, yaw: 0, pitch: 0, roll: 0 });
});
test('reset actualiza estado y sticks sin reutilizar una instantánea anterior', () => {
  const service = new ControllerStateService();
  service.setLeftStick({ x: .2, y: .6 });
  const previous = service.state();
  service.reset();
  assert.equal(previous.throttle, .8);
  assert.equal(service.throttle(), 0);
  assert.equal(service.leftStick().y, -1);
});
