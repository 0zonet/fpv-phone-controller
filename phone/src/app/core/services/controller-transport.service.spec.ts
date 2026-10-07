import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ControllerTransportService } from './controller-transport.service';
import { SOCKET_FACTORY, TRANSPORT_CLOCK } from './transport-runtime';
import { FakeClock, FakeSocket } from './transport-test-runtime';

const axes = { throttle: .42, yaw: -.14, pitch: .72, roll: .05 };
test('diagnóstico mide envíos efectivos, sequence y backpressure sin timers adicionales', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://localhost:8080'); sockets[0].open();
  for (let i = 0; i < 60; i++) { transport.send(axes); clock.advance(1000 / 60); }
  clock.advance(1); transport.send(axes);
  assert.equal(transport.packetsPerSecond(), 60);
  assert.equal(transport.lastSequence(), 60);
  sockets[0].bufferedAmount = 5000;
  clock.advance(1001); transport.send(axes);
  clock.advance(1001); transport.send(axes);
  assert.equal(transport.packetsPerSecond(), 0);
  assert.equal(transport.lastSequence(), 60);
  assert.equal(clock.tasks.size, 0);
  transport.disconnect(); assert.equal(transport.packetsPerSecond(), 0);
});
function setup() {
  const sockets: FakeSocket[] = [];
  const clock = new FakeClock();
  const injector = Injector.create({ providers: [
    { provide: SOCKET_FACTORY, useValue: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; } },
    { provide: TRANSPORT_CLOCK, useValue: clock }
  ] });
  const transport = runInInjectionContext(injector, () => new ControllerTransportService());
  return { transport, sockets, clock };
}
test('transporte expone estados readonly y no envía antes de abrir o después de cerrar', () => {
  const { transport, sockets } = setup();
  assert.equal(transport.status(), 'disconnected'); assert.equal('set' in transport.status, false);
  transport.send(axes); transport.connect('ws://localhost:8080');
  const socket = sockets[0];
  assert.equal(transport.status(), 'connecting'); transport.send(axes); assert.equal(socket.messages.length, 0);
  socket.open(); assert.equal(transport.status(), 'connected'); transport.send(axes);
  transport.disconnect(); transport.send(axes);
  assert.equal(transport.status(), 'disconnected'); assert.equal(socket.messages.length, 1);
});
test('envía protocolo JSON, timestamp y sequence creciente sin mutar estado', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://localhost:8080'); const socket = sockets[0]; socket.open();
  transport.send(axes); clock.advance(17); transport.send(axes);
  assert.deepEqual(JSON.parse(socket.messages[0]), { type: 'controller-state', sequence: 0, timestamp: 1700000000000, axes });
  assert.deepEqual(JSON.parse(socket.messages[1]), { type: 'controller-state', sequence: 1, timestamp: 1700000000017, axes });
  assert.deepEqual(axes, { throttle: .42, yaw: -.14, pitch: .72, roll: .05 });
  transport.disconnect(); assert.equal(clock.tasks.size, 0);
});
test('no envía en CLOSING/CLOSED ni incrementa sequence por backpressure', () => {
  const { transport, sockets } = setup();
  transport.connect('ws://localhost:8080'); const socket = sockets[0]; socket.open();
  socket.readyState = 2; transport.send(axes); socket.readyState = 3; transport.send(axes);
  socket.readyState = 1; socket.bufferedAmount = 5000; transport.send(axes);
  assert.equal(socket.messages.length, 0);
  socket.bufferedAmount = 0; transport.send(axes);
  assert.equal(JSON.parse(socket.messages[0]).sequence, 0);
  transport.disconnect();
});
test('error y timeout limpian recursos sin reconexión automática', () => {
  const { transport, sockets, clock } = setup();
  transport.connect('ws://localhost:8080'); sockets[0].error();
  assert.equal(transport.status(), 'error'); assert.equal(clock.tasks.size, 0);
  transport.connect('ws://localhost:8080'); clock.advance(8000);
  assert.equal(transport.status(), 'error'); assert.equal(sockets.length, 2); assert.equal(sockets[1].readyState, 3);
  transport.send(axes); assert.equal(sockets[1].messages.length, 0);
});
test('reemplaza socket y descarta eventos tardíos; reinicia sequence por conexión', () => {
  const { transport, sockets } = setup();
  transport.connect('ws://localhost:8080'); sockets[0].open(); transport.send(axes);
  transport.connect('ws://localhost:8081'); sockets[0].open(); sockets[0].error();
  assert.equal(transport.status(), 'connecting');
  sockets[1].open(); transport.send(axes);
  assert.equal(JSON.parse(sockets[1].messages[0]).sequence, 0);
  sockets[1].close(); assert.equal(transport.status(), 'disconnected');
});
test('dirección inválida y fallo de envío se convierten en ERROR', () => {
  const { transport, sockets } = setup();
  transport.connect('http://localhost'); assert.equal(transport.status(), 'error'); assert.equal(sockets.length, 0);
  transport.connect('ws://localhost:8080'); sockets[0].open(); sockets[0].failSend = true;
  transport.send(axes); assert.equal(transport.status(), 'error'); assert.equal(sockets[0].messages.length, 0);
});
