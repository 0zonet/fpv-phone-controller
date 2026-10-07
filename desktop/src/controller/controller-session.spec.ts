import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerSession, type FailsafeClock } from './controller-session.js';
import { ControllerMapper } from './controller-mapper.js';
import { FakeVirtualController } from './fake-virtual-controller.js';
import { defaultConfig } from '../config.js';

class Clock implements FailsafeClock {
  time = 0;
  task: { deadline: number; callback: () => void } | undefined;
  now(): number { return this.time; }
  schedule(callback: () => void, delay: number): () => void {
    assert.equal(this.task, undefined); const task = { deadline: this.time + delay, callback }; this.task = task;
    return () => { if (this.task === task) this.task = undefined; };
  }
  advance(ms: number): void {
    const end = this.time + ms;
    while (this.task && this.task.deadline <= end) {
      this.time = this.task.deadline; const callback = this.task.callback; this.task = undefined; callback();
    }
    this.time = end;
  }
}
const moving = { throttle: .8, yaw: -.2, pitch: .3, roll: .4 };
test('métricas cuentan escrituras exitosas y distinguen failsafe de recuperación', async () => {
  const { session, clock } = await setup();
  session.receive(moving); clock.advance(100); session.receive(moving); clock.advance(100);
  assert.deepEqual(session.sampleMetrics(), { updatesPerSecond: 10, failsafe: false });
  clock.advance(150);
  assert.deepEqual(session.sampleMetrics(), { updatesPerSecond: 1000 / 150, failsafe: true });
  session.receive(moving);
  assert.equal(session.sampleMetrics().failsafe, false); session.stop();
});
async function setup(invertThrottle = false) {
  const device = new FakeVirtualController(); await device.connect();
  const clock = new Clock(); const logs: string[] = [];
  const mapper = new ControllerMapper({ calibration: { ...defaultConfig.calibration, throttle: { ...defaultConfig.calibration.throttle, invert: invertThrottle } } });
  const session = new ControllerSession(device, mapper, 250, line => logs.push(line), clock);
  return { device, clock, logs, session };
}
test('aplica cada último estado inmediatamente sin loop ni cola', async () => {
  const { device, session } = await setup();
  session.receive(moving); session.receive({ ...moving, throttle: .2 });
  assert.equal(device.updates.length, 2); assert.equal(device.axes.throttle, .2); session.stop();
});
test('failsafe se activa a 250 ms y solo una vez durante el silencio', async () => {
  const { device, clock, logs, session } = await setup();
  session.receive(moving); clock.advance(249); assert.equal(device.axes.throttle, .8);
  clock.advance(1); assert.deepEqual(device.axes, { throttle: 0, yaw: 0, pitch: 0, roll: 0 });
  clock.advance(1000); assert.deepEqual(logs, ['FAILSAFE ACTIVE']); session.stop();
});
test('cada paquete válido desplaza el plazo sin acumular timers', async () => {
  const { device, clock, session } = await setup();
  session.receive(moving); clock.advance(200); session.receive(moving);
  clock.advance(249); assert.equal(device.axes.throttle, .8);
  clock.advance(1); assert.equal(device.axes.throttle, 0); session.stop();
});
test('desconexión resetea inmediatamente y no duplica failsafe', async () => {
  const { device, logs, clock, session } = await setup();
  session.receive(moving); session.disconnect(); session.disconnect();
  assert.equal(device.axes.throttle, 0); assert.equal(clock.task, undefined);
  assert.deepEqual(logs, ['FAILSAFE ACTIVE']); session.stop();
});
test('failsafe ignora inversión de throttle y permite recuperar con un paquete nuevo', async () => {
  const { device, clock, session } = await setup(true);
  session.receive({ ...moving, throttle: .2 }); assert.equal(device.axes.throttle, .8);
  clock.advance(250); assert.equal(device.axes.throttle, 0);
  session.receive({ ...moving, throttle: .5 }); assert.equal(device.axes.throttle, .5); session.stop();
});
test('stop cancela timer y bloquea estados tardíos', async () => {
  const { device, clock, session } = await setup();
  session.receive(moving); session.stop(); session.receive({ ...moving, throttle: .1 });
  assert.equal(clock.task, undefined); assert.equal(device.updates.length, 1);
});
