import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';

test('config centraliza valores iniciales y permite overrides de entorno', () => {
  const config = loadConfig({});
  assert.equal(config.websocketPort, 8080); assert.equal(config.controller.deviceId, 1); assert.equal(config.controller.failsafeMs, 250);
  const changed = loadConfig({ PORT: '8081', VJOY_DEVICE_ID: '2', FAILSAFE_MS: '300' });
  assert.equal(changed.websocketPort, 8081); assert.equal(changed.controller.deviceId, 2); assert.equal(changed.controller.failsafeMs, 300);
});
test('rechaza configuración inválida antes de tocar el driver', () => {
  for (const environment of [{ PORT: '0' }, { VJOY_DEVICE_ID: '17' }, { FAILSAFE_MS: '0' }, { FAILSAFE_MS: 'bad' }]) {
    assert.throws(() => loadConfig(environment));
  }
});
