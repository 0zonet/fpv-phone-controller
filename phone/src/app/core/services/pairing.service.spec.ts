import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PairingService } from './pairing.service';
import { createPairingPayload, createPairingUrl } from '../../../../../shared/src/pairing';
test('phone decodes desktop URL into authorized WebSocket endpoint', () => {
  const service = new PairingService();
  const token = 'b'.repeat(48);
  const url = createPairingUrl('https://fpv.brycofre.com', createPairingPayload('192.168.42.129', 8080, token));
  assert.equal(service.parsePairingUrl(url), 'ws://192.168.42.129:8080/?token=' + token);
});
test('phone rejects malformed URL, duplicate payload and unsupported protocol', () => {
  const service = new PairingService();
  const url = createPairingUrl('https://fpv.brycofre.com', createPairingPayload('10.0.0.2', 8080, 'c'.repeat(48)));
  for (const value of ['javascript:alert(1)', url + '&data=abc', url + '&host=evil', url + '#abc',
    'https://fpv.brycofre.com/connect', 'https://fpv.brycofre.com/connect?data=invalid',
    url.replace('/connect?', '/other?')]) assert.throws(() => service.parsePairingUrl(value));
});
