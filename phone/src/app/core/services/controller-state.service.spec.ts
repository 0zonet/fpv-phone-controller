import { neutralButtons } from '../../../../../shared/src/index';
import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerStateService } from './controller-state.service';
import { releaseValue } from '../../features/controller/utils/stick-math';

test('inicia radio Mode 2 en reposo y throttle mínimo', () => {
  const service = new ControllerStateService();
  assert.deepEqual(service.state(), { throttle: 0, yaw: 0, pitch: 0, roll: 0, buttons: neutralButtons() });
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
  assert.deepEqual(service.state(), { throttle: .7, yaw: -.3, pitch: -.2, roll: .6, buttons: neutralButtons() });
});
test('rangos quedan protegidos incluso ante entradas fuera del componente', () => {
  const service = new ControllerStateService();
  service.setLeftStick({ x: -20, y: 20 });
  service.setRightStick({ x: 20, y: -20 });
  assert.deepEqual(service.state(), { throttle: 1, yaw: -1, pitch: -1, roll: 1, buttons: neutralButtons() });
  service.setLeftStick({ x: NaN, y: Infinity });
  service.setRightStick({ x: Infinity, y: NaN });
  assert.deepEqual(service.state(), { throttle: 0, yaw: 0, pitch: 0, roll: 0, buttons: neutralButtons() });
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
  assert.deepEqual(service.state(), { throttle: .8, yaw: 0, pitch: 0, roll: 0, buttons: neutralButtons() });
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

test('eight readonly buttons validate indices and preserve axes on resetButtons', () => {
  const service = new ControllerStateService();
  assert.equal(service.buttons().length, 8); assert.equal('set' in service.buttons, false);
  service.setLeftStick({ x: .4, y: .6 }); service.setButton(0, true); service.toggleButton(7);
  assert.equal(service.buttons()[0], true); assert.equal(service.buttons()[7], true);
  service.toggleButton(7); assert.equal(service.buttons()[7], false);
  for (const index of [-1, 8, .5, NaN, Infinity]) {
    assert.throws(() => service.setButton(index, true), RangeError);
    assert.throws(() => service.toggleButton(index), RangeError);
  }
  service.resetButtons(); assert.deepEqual(service.buttons(), neutralButtons());
  assert.equal(service.throttle(), .8); assert.equal(service.yaw(), .4);
  assert.equal(Object.isFrozen(service.buttons()), true);
  try { (service.buttons() as boolean[])[0] = true; } catch { /* Strict runtimes throw for frozen arrays. */ }
  assert.equal(service.buttons()[0], false);
});
