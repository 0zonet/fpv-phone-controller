import { neutralButtons } from '../../../../../shared/src/index';
import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerTransportService } from './controller-transport.service';
import { SOCKET_FACTORY, TRANSPORT_CLOCK } from './transport-runtime';
import { FakeClock, FakeSocket } from './transport-test-runtime';

const axes = { throttle: .5, yaw: 0, pitch: 0, roll: 0, buttons: neutralButtons() };
function setup() {
  const sockets: FakeSocket[] = [];
  const clock = new FakeClock();
  const injector = Injector.create({ providers: [
    { provide: SOCKET_FACTORY, useValue: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; } },
    { provide: TRANSPORT_CLOCK, useValue: clock }
  ] });
  return { transport: runInInjectionContext(injector, () => new ControllerTransportService()), sockets, clock };
}
const hello = { type: 'hello', protocol: 2, capabilities: ['ack', 'close-codes'] };

test('latencia por RTT con ack del PC; "—" (null) con un companion sin hello', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080'); sockets[0].open();
  transport.send(axes); clock.advance(17); transport.send(axes);
  assert.equal(transport.latency(), null);
  sockets[0].receive(hello); clock.advance(13);
  sockets[0].receive({ type: 'ack', sequence: 1 });
  assert.equal(transport.latency(), 13);
  clock.advance(10); transport.send(axes); clock.advance(23); sockets[0].receive({ type: 'ack', sequence: 2 });
  assert.equal(transport.latency(), Math.round(13 * .7 + 23 * .3));
  // Heartbeat ack of an already measured sequence does not change the latency.
  clock.advance(900); sockets[0].receive({ type: 'ack', sequence: 2 }); assert.equal(transport.latency(), 16);
  for (const junk of ['nope', '{"type":"ack","sequence":"x"}', JSON.stringify({ type: 'other' })]) sockets[0].receive(junk);
  assert.equal(transport.status(), 'connected');
  transport.disconnect(); assert.equal(transport.latency(), null);
});
test('sin ack durante ~2 s marca la conexión como perdida y reconecta', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080'); sockets[0].open(); sockets[0].receive(hello);
  for (let i = 0; i < 100; i++) { clock.advance(1000 / 60); transport.send(axes); }
  assert.equal(transport.status(), 'connected', 'still within 2 s');
  for (let i = 0; i < 30; i++) { clock.advance(1000 / 60); transport.send(axes); }
  assert.equal(transport.connectionLost(), true); assert.equal(transport.reconnecting(), true);
  assert.equal(transport.status(), 'connecting'); assert.equal(sockets[0].readyState, 3);
});
test('un companion antiguo (sin hello) nunca dispara la pérdida por falta de ack', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080'); sockets[0].open();
  for (let i = 0; i < 600; i++) { clock.advance(1000 / 60); transport.send(axes); }
  assert.equal(transport.status(), 'connected'); assert.equal(sockets[0].messages.length, 600);
  transport.disconnect();
});
test('reconexión con backoff 0,5/1/2/4 s y abandono a los ~30 s', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080/?token=t'); sockets[0].open(); sockets[0].close();
  const startedAt = clock.now();
  const opened: number[] = [];
  for (let i = 0; i < 40 && transport.reconnecting(); i++) {
    const count = sockets.length;
    clock.advance(1);
    while (sockets.length === count && transport.reconnecting()) clock.advance(1);
    if (sockets.length > count) { opened.push(clock.now() - startedAt); sockets.at(-1)!.error(); }
  }
  const gaps = opened.map((time, i) => time - (i ? opened[i - 1] : 0));
  assert.deepEqual(gaps.slice(0, 5), [500, 1000, 2000, 4000, 4000]);
  assert.ok(opened.at(-1)! < 30000 + 4000);
  assert.equal(transport.reconnecting(), false); assert.equal(transport.status(), 'error'); assert.equal(transport.connectionLost(), true);
  assert.equal(clock.tasks.size, 0);
});
test('si reconecta, vuelve a connected, limpia "perdida" y reinicia sequence', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080/?token=t'); sockets[0].open(); transport.send(axes); transport.send(axes);
  sockets[0].close(); clock.advance(500);
  assert.equal(sockets.length, 2); sockets[1].open();
  assert.equal(transport.status(), 'connected'); assert.equal(transport.connectionLost(), false); assert.equal(transport.reconnecting(), false);
  transport.send(axes); assert.equal(JSON.parse(sockets[1].messages[0]).sequence, 0);
  transport.disconnect();
});
test('cierre 4001 (desde el PC) y 4003 (QR antiguo) nunca reconectan', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080'); sockets[0].open(); sockets[0].close(4001);
  assert.equal(transport.status(), 'disconnected'); assert.equal(transport.endReason(), 'pc');
  assert.equal(transport.connectionLost(), false); assert.equal(transport.reconnecting(), false);
  clock.advance(60000); assert.equal(sockets.length, 1);
  transport.connect('ws://pc:8080'); assert.equal(transport.endReason(), '');
  sockets[1].close(4003);
  assert.equal(transport.status(), 'error'); assert.equal(transport.endReason(), 'rejected');
  assert.match(transport.errorMessage(), /QR/); clock.advance(60000); assert.equal(sockets.length, 2);
});
test('un 4003 durante la reconexión (el PC se reinició) detiene los reintentos', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080'); sockets[0].open(); sockets[0].close();
  clock.advance(500); sockets[1].close(4003);
  assert.equal(transport.reconnecting(), false); assert.equal(transport.endReason(), 'rejected');
  clock.advance(60000); assert.equal(sockets.length, 2);
});
test('Desconectar o Cancelar durante la reconexión la detiene', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://pc:8080'); sockets[0].open(); sockets[0].close();
  assert.equal(transport.reconnecting(), true);
  transport.disconnect();
  assert.equal(transport.reconnecting(), false); assert.equal(transport.status(), 'disconnected'); assert.equal(transport.connectionLost(), false);
  clock.advance(60000); assert.equal(sockets.length, 1); assert.equal(clock.tasks.size, 0);
});
