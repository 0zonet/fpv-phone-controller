import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { startCompanion } from './companion.js';
import { defaultConfig } from './config.js';
import { FakeVirtualController } from './controller/fake-virtual-controller.js';

const message = (sequence: number) => JSON.stringify({ type: 'controller-state', sequence, timestamp: Date.now(),
  axes: { throttle: .6, yaw: -.2, pitch: .1, roll: .4 } });

test('WebSocket alimenta fake controller y desconexión activa failsafe', async () => {
  const device = new FakeVirtualController(); const logs: string[] = [];
  const companion = await startCompanion({ ...defaultConfig, websocketPort: 0, websocketHost: '127.0.0.1' }, device, line => logs.push(line));
  const address = companion.server.address(); assert.ok(address && typeof address !== 'string');
  const accepted = once(companion.server, 'connection');
  const client = new WebSocket('ws://127.0.0.1:' + address.port);
  try {
    await once(client, 'open'); const [peer] = await accepted;
    const received = once(peer, 'message'); client.send(message(0)); await received;
    assert.deepEqual(device.axes, { throttle: .6, yaw: -(.2 - .03) / .97, pitch: -(.1 - .03) / .97, roll: (.4 - .03) / .97 });
    const duplicate = once(peer, 'message'); client.send(message(0)); await duplicate;
    assert.equal(device.updates.length, 1);
    const peerClosed = once(peer, 'close'); const closed = once(client, 'close'); client.close(); await Promise.all([peerClosed, closed]);
    assert.deepEqual(device.axes, { throttle: 0, yaw: 0, pitch: 0, roll: 0 });
    assert.ok(logs.includes('FAILSAFE ACTIVE'));
  } finally { client.terminate(); await companion.shutdown(); }
  assert.equal(device.connected, false);
  assert.deepEqual(device.calls.slice(-2), ['reset', 'disconnect']);
});
test('dos teléfonos no pueden disputar el mismo dispositivo', async () => {
  const device = new FakeVirtualController();
  const companion = await startCompanion({ ...defaultConfig, websocketPort: 0, websocketHost: '127.0.0.1' }, device, () => {});
  const address = companion.server.address(); assert.ok(address && typeof address !== 'string');
  const first = new WebSocket('ws://127.0.0.1:' + address.port);
  let second: WebSocket | undefined;
  try {
    await once(first, 'open');
    second = new WebSocket('ws://127.0.0.1:' + address.port);
    const closed = once(second, 'close'); await once(second, 'open');
    const [code] = await closed; assert.equal(code, 1008); assert.equal(first.readyState, WebSocket.OPEN);
  } finally { first.terminate(); second?.terminate(); await companion.shutdown(); }
});
test('shutdown es idempotente y resetea antes de liberar el controlador', async () => {
  const device = new FakeVirtualController();
  const companion = await startCompanion({ ...defaultConfig, websocketPort: 0, websocketHost: '127.0.0.1' }, device, () => {});
  const shutdown = companion.shutdown(); assert.equal(companion.shutdown(), shutdown); await shutdown;
  assert.deepEqual(device.calls, ['connect', 'reset', 'disconnect']);
});
test('si falla reset, shutdown igualmente libera el driver y cierra WebSocket', async () => {
  class ResetFailure extends FakeVirtualController { override reset(): void { throw new Error('Removed device'); } }
  const device = new ResetFailure();
  const companion = await startCompanion({ ...defaultConfig, websocketPort: 0, websocketHost: '127.0.0.1' }, device, () => {});
  await assert.rejects(companion.shutdown(), AggregateError);
  assert.equal(device.connected, false); assert.equal(companion.server.address(), null);
});
