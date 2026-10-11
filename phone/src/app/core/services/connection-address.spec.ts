import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validEndpoint, publicEndpoint, editEndpoint } from './connection-address';
test('editor never renders token, credentials, fragment or other query parameters', () => {
  assert.equal(publicEndpoint('ws://192.168.1.92:8080/?token=secret&other=private'), 'ws://192.168.1.92:8080/');
  assert.equal(publicEndpoint('ws://user:secret@192.168.1.92:8080/?token=hidden#fragment'), 'ws://192.168.1.92:8080/');
  assert.equal(publicEndpoint('ws://partial?token=secret'), 'ws://partial/');
});
test('manual edits retain stored authorization only for the same endpoint', () => {
  const previous = 'ws://192.168.1.92:8080/?token=secret';
  assert.equal(editEndpoint('ws://192.168.1.92:8080/', previous), previous);
  assert.equal(editEndpoint('ws://192.168.1.93:8080/', previous), 'ws://192.168.1.93:8080/');
  assert.equal(editEndpoint('ws://192.168.1.93:8080/?token=new', previous), 'ws://192.168.1.93:8080/?token=new');
});
test('stored endpoints require WebSocket protocol and disallow credentials', () => {
  for (const value of ['', 'not a URL', 'javascript:alert(1)', 'https://example.com', 'ws://user:secret@localhost', 'ws://localhost:99999'])
    assert.equal(validEndpoint(value), null);
  assert.equal(validEndpoint('wss://localhost:8080'), 'wss://localhost:8080/');
});
