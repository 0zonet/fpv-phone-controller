import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerMetrics } from './controller-metrics.js';
import type { ControllerMessage } from '../models/controller-message.js';

const message = (sequence: number): ControllerMessage => ({ type: 'controller-state', sequence, timestamp: 1000, axes: { throttle: .5, yaw: 0, pitch: 0, roll: 0 } });
test('mide tasa, sequence y huecos sin perder el último estado por duplicados', () => {
  const metrics = new ControllerMetrics(0);
  metrics.receive(message(0), 10); metrics.receive(message(1), 20); metrics.receive(message(4), 30);
  assert.equal(metrics.lostPackets, 2); assert.equal(metrics.lastSequence, 4);
  assert.equal(metrics.receive(message(3), 40), false);
  assert.equal(metrics.lastSequence, 4); assert.equal(metrics.receivedAt, 30);
  assert.equal(metrics.sampleRate(1000), 4); assert.equal(metrics.sampleRate(2000), 0);
});
test('primer sequence distinto de cero cuenta huecos y nueva sesión empieza limpia', () => {
  const metrics = new ControllerMetrics(0); metrics.receive(message(3), 10);
  assert.equal(metrics.lostPackets, 3);
  const newSession = new ControllerMetrics(10); newSession.receive(message(0), 11);
  assert.equal(newSession.lostPackets, 0); assert.equal(newSession.lastSequence, 0);
});
