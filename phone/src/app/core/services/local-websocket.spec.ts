import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openLocalWebSocket } from './local-websocket';

test('HTTPS declara espacio local y mantiene fallback para motores sin WebSocketInit', () => {
  const originalSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const calls: unknown[] = [];
  let legacy = false;
  class Socket {
    constructor(public url: string, options?: unknown) {
      calls.push(options);
      if (legacy && options) throw new TypeError('Unsupported constructor');
    }
  }
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'https:' } });
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: Socket });
    openLocalWebSocket('ws://192.168.2.5:8080/?token=test');
    assert.deepEqual(calls, [{ protocols: [], targetAddressSpace: 'local' }]);
    calls.length = 0; legacy = true;
    openLocalWebSocket('ws://192.168.2.5:8080/?token=test');
    assert.deepEqual(calls, [{ protocols: [], targetAddressSpace: 'local' }, undefined]);
    calls.length = 0;
    openLocalWebSocket('wss://local.example');
    assert.deepEqual(calls, [undefined]);
  } finally {
    if (originalSocket) Object.defineProperty(globalThis, 'WebSocket', originalSocket);
    else Reflect.deleteProperty(globalThis, 'WebSocket');
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});
