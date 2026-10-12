import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createControllerWebSocketServer } from './controller-websocket-server.js';

const state = (sequence: number) => JSON.stringify({ type: 'controller-state', sequence, timestamp: Date.now(),
  axes: { throttle: .5, yaw: 0, pitch: 0, roll: 0 } });
async function start(options: Parameters<typeof createControllerWebSocketServer>[0] = {}) {
  const server = createControllerWebSocketServer({ port: 0, host: '127.0.0.1', log: () => {}, ...options });
  await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { server, url: 'ws://127.0.0.1:' + address.port };
}
const collect = (socket: WebSocket) => {
  const messages: { type: string; [key: string]: unknown }[] = [];
  socket.on('message', data => messages.push(JSON.parse(data.toString())));
  return messages;
};

test('hello al conectar y ack inmediato con el último sequence, como mucho cada 500 ms', async () => {
  const { server, url } = await start();
  const client = new WebSocket(url); const messages = collect(client);
  try {
    await once(client, 'open');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.deepEqual(messages[0], { type: 'hello', protocol: 2, capabilities: ['ack', 'close-codes'] });
    client.send(state(0)); client.send(state(1)); client.send(state(2));
    await new Promise(resolve => setTimeout(resolve, 60));
    const acks = messages.filter(message => message.type === 'ack');
    assert.deepEqual(acks, [{ type: 'ack', sequence: 0 }]);
    await new Promise(resolve => setTimeout(resolve, 520)); client.send(state(3));
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.deepEqual(messages.filter(message => message.type === 'ack').at(-1), { type: 'ack', sequence: 3 });
  } finally { client.terminate(); await new Promise(resolve => server.close(resolve)); }
});
test('sin mensajes nuevos repite el último ack cada segundo (latido)', async () => {
  const { server, url } = await start();
  const client = new WebSocket(url); const messages = collect(client);
  try {
    await once(client, 'open'); client.send(state(7));
    await new Promise(resolve => setTimeout(resolve, 1700));
    const acks = messages.filter(message => message.type === 'ack');
    assert.ok(acks.length >= 2); assert.ok(acks.every(ack => ack.sequence === 7));
  } finally { client.terminate(); await new Promise(resolve => server.close(resolve)); }
});
test('token antiguo: acepta el upgrade y cierra con 4003 sin contar como teléfono', async () => {
  let phones = 0;
  const { server, url } = await start({ authorize: (_peer, _origin, requestUrl) => requestUrl.includes('token=new') ? 'accept' : 'invalid-token',
    onPhoneConnected: () => { phones += 1; } });
  const old = new WebSocket(url + '/?token=old');
  try {
    const [code] = await once(old, 'close'); assert.equal(code, 4003); assert.equal(phones, 0);
    const current = new WebSocket(url + '/?token=new');
    await once(current, 'open'); assert.equal(phones, 1); current.terminate();
  } finally { old.terminate(); await new Promise(resolve => server.close(resolve)); }
});
test('acknowledge: false mantiene el comportamiento antiguo (sin mensajes al teléfono)', async () => {
  const { server, url } = await start({ acknowledge: false });
  const client = new WebSocket(url); const messages = collect(client);
  try {
    await once(client, 'open'); client.send(state(0));
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.deepEqual(messages, []);
  } finally { client.terminate(); await new Promise(resolve => server.close(resolve)); }
});
