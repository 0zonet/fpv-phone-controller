import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createControllerWebSocketServer } from './websocket/controller-websocket-server.js';

test('servidor recibe JSON y reporta último estado una vez por segundo', async () => {
  const logs: string[] = [];
  let resolveReport: (line: string) => void = () => {};
  const report = new Promise<string>(resolve => { resolveReport = resolve; });
  const server = createControllerWebSocketServer({ port: 0, host: '127.0.0.1', log: line => {
    logs.push(line); if (line.includes('THR ')) resolveReport(line);
  } });
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const client = new WebSocket('ws://127.0.0.1:' + address.port);
  const deadline = setTimeout(() => resolveReport('timeout'), 3000);
  try {
    await once(client, 'open');
    for (let sequence = 0; sequence < 60; sequence += 1) {
      client.send(JSON.stringify({ type: 'controller-state', sequence, timestamp: Date.now(),
        axes: { throttle: .42, yaw: -.14, pitch: .72, roll: .05 } }));
    }
    const line = await report;
    assert.match(line, /THR 0.42 \| YAW -0.14 \| PIT 0.72 \| ROL 0.05/);
    assert.match(line, /SEQ 59 \| LOST 0/);
    assert.equal(logs.filter(item => item.includes('THR ')).length, 1);
    assert.ok(logs.some(item => item.includes('Client connected: 127.0.0.1')));
    const closed = once(client, 'close');
    client.send(JSON.stringify({ type: 'controller-state', sequence: 60, timestamp: Date.now(),
      axes: { throttle: .5, yaw: 0, pitch: 0, roll: 2 } }));
    const [code] = await closed;
    assert.equal(code, 1008);
  } finally {
    clearTimeout(deadline); client.terminate();
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('JSON inválido y payload binario cierran el cliente sin derribar el servidor', async () => {
  const server = createControllerWebSocketServer({ port: 0, host: '127.0.0.1', log: () => {} });
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    for (const payload of ['{bad json', Buffer.from('{}')]) {
      const client: WebSocket = new WebSocket('ws://127.0.0.1:' + address.port);
      await once(client, 'open');
      const closed = once(client, 'close'); client.send(payload);
      const [code] = await closed; assert.equal(code, 1008);
    }
  } finally {
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
