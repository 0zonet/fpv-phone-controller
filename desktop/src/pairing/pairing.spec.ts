import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPairingPayload, createPairingUrl, encodePairingPayload, decodePairingPayload, pairingEndpoint } from '../../../shared/src/pairing.js';
import { PairingService } from './pairing-service.js';
const token = 'a'.repeat(48);
test('pairing encode/decode roundtrip and secure endpoint', () => {
  const payload = createPairingPayload('192.168.42.129', 8080, token);
  const encoded = encodePairingPayload(payload);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePairingPayload(encoded), payload);
  const url = new URL(createPairingUrl('https://fpv.brycofre.com', payload));
  assert.equal(url.pathname, '/connect');
  assert.deepEqual(decodePairingPayload(url.searchParams.get('data')!), payload);
  assert.equal(pairingEndpoint(payload), 'ws://192.168.42.129:8080/?token=' + token);
});
test('reject invalid version, host, port, token and extra protocol', () => {
  const good = createPairingPayload('10.0.0.2', 8080, token);
  for (const patch of [{version:2}, {host:'example.com'}, {host:'8.8.8.8'}, {host:'127.0.0.1'}, {host:'192.168.001.2'},
    {host:'192.168.1.999'}, {host:'ws://192.168.1.2'}, {port:0}, {port:65536}, {port:1.5}, {port:'8080'},
    {token:''}, {protocol:'javascript:'}]) {
    const encoded = btoa(JSON.stringify({...good, ...patch})).replace(/=+$/, '').replace(/\+/g,'-').replace(/\//g,'_');
    assert.throws(() => decodePairingPayload(encoded));
  }
  for (const invalid of ['', '%', 'a', 'a'.repeat(1025), btoa('null'), btoa('[]')]) assert.throws(() => decodePairingPayload(invalid));
});
test('private ranges and port boundaries accepted', () => {
  for (const host of ['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.1.1'])
    for (const port of [1,65535]) assert.equal(createPairingPayload(host, port, token).port, port);
});
test('QR is a PNG containing a public pairing URL', async () => {
  const result = await new PairingService().create('https://fpv.brycofre.com', '192.168.1.1', 8080, token);
  assert.equal(Buffer.from(result.qrPngBase64, 'base64').subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(new URL(result.url).origin, 'https://fpv.brycofre.com');
  assert.throws(() => createPairingUrl('javascript:alert(1)', createPairingPayload('192.168.1.1',8080,token)));
});
