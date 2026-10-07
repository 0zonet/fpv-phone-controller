import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, limitToCircle, normalize, pointerToValue, releaseValue, valueToVisual } from './stick-math';

const bounds = { left: 20, top: 40, width: 200, height: 200 };
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);

test('clamp limita ambos extremos, conserva valores válidos y sanea entradas no finitas', () => {
  assert.equal(clamp(-2), -1);
  assert.equal(clamp(2), 1);
  assert.equal(clamp(.3), .3);
  assert.equal(clamp(-.5, 0, 1), 0);
  assert.equal(clamp(NaN), 0);
  assert.equal(clamp(Infinity), 0);
  assert.throws(() => clamp(1, 2, 0), RangeError);
});
test('normalización usa el radio y tolera un área sin tamaño', () => {
  assert.equal(normalize(34, 68), .5);
  assert.equal(normalize(4, 0), 0);
  assert.equal(normalize(4, -1), 0);
});
test('pointer usa el centro local, escala por el recorrido y permite invertir Y', () => {
  assert.deepEqual(pointerToValue(120, 140, bounds), { x: 0, y: -0 });
  close(pointerToValue(154, 106, bounds).x, .5);
  close(pointerToValue(154, 106, bounds).y, .5);
  close(pointerToValue(154, 106, bounds, false).y, -.5);
  close(pointerToValue(188, 140, bounds).x, 1);
  close(pointerToValue(120, 208, bounds).y, -1);
});
test('limitación circular conserva dirección y limita distancia, no solo ejes', () => {
  const value = limitToCircle({ x: 3, y: 4 });
  close(value.x, .6); close(value.y, .8); close(Math.hypot(value.x, value.y), 1);
  assert.deepEqual(limitToCircle({ x: .2, y: -.3 }), { x: .2, y: -.3 });
  const outside = pointerToValue(1000, -1000, bounds);
  close(Math.hypot(outside.x, outside.y), 1);
  assert.deepEqual(limitToCircle({ x: NaN, y: Infinity }), { x: 0, y: 0 });
  assert.throws(() => limitToCircle({ x: 0, y: 0 }, -1), RangeError);
});
test('coordenadas visuales son porcentajes separados del valor normalizado', () => {
  assert.deepEqual(valueToVisual({ x: 0, y: 0 }), { x: 50, y: 50 });
  assert.deepEqual(valueToVisual({ x: 0, y: 1 }), { x: 50, y: 16 });
  assert.deepEqual(valueToVisual({ x: 0, y: 1 }, false), { x: 50, y: 84 });
});
test('autocentrado del derecho devuelve ambos ejes a cero sin mutar la entrada', () => {
  const value = { x: .3, y: -.6 };
  assert.deepEqual(releaseValue(value, { x: true, y: true }), { x: 0, y: 0 });
  assert.deepEqual(value, { x: .3, y: -.6 });
});
test('persistencia del izquierdo centra X y mantiene exactamente Y al soltar o cancelar', () => {
  for (const y of [-1, -.6, 0, .6, 1]) {
    const value = limitToCircle({ x: .2, y });
    const released = releaseValue(value, { x: true, y: false });
    assert.equal(released.x, 0); assert.equal(released.y, value.y);
  }
});
