import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerTransmissionLoop } from './controller-transmission-loop';
import { FakeClock } from './transport-test-runtime';

test('loop emite aproximadamente 60 Hz y start repetido no crea timers duplicados', () => {
  const clock = new FakeClock(); let packets = 0;
  const loop = new ControllerTransmissionLoop(clock, () => { packets += 1; });
  loop.start(); loop.start(); assert.equal(clock.tasks.size, 1);
  clock.advance(1000); assert.ok(packets >= 59 && packets <= 60);
  assert.equal(clock.tasks.size, 1);
  loop.stop(); assert.equal(clock.tasks.size, 0);
  clock.advance(1000); assert.ok(packets >= 59 && packets <= 60);
});
test('usa el último estado y no recupera con ráfagas los ticks perdidos', () => {
  const clock = new FakeClock(); let state = 0; const received: number[] = [];
  const loop = new ControllerTransmissionLoop(clock, () => received.push(state));
  loop.start(); state = 1; state = 2; clock.advance(17); assert.deepEqual(received, [2]);
  clock.time += 1000; clock.advance(0); assert.deepEqual(received, [2, 2]);
  loop.stop(); loop.start(); state = 3; clock.advance(17); assert.deepEqual(received, [2, 2, 3]);
  loop.stop();
});
