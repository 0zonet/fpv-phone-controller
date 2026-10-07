import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usefulAddresses, isPrivateIpv4, authorizedConnection } from './local-network.js';
const local = { name: 'Wi-Fi', address: '192.168.2.10', netmask: '255.255.255.0' };
test('filtra IP pública, loopback y adaptadores virtuales', () => {
  const entry = (address: string) => ({ address, netmask: local.netmask, family: 'IPv4' as const, mac: '00', internal: false, cidr: null });
  assert.deepEqual(usefulAddresses({ 'Wi-Fi': [entry(local.address)], 'vEthernet': [entry('172.20.1.1')], 'WAN': [entry('8.8.8.8')] }), [local]);
  assert.equal(isPrivateIpv4('192.168.1.999'), false);
});
test('solo acepta subred local, origen permitido y clave de sesión', () => {
  const allow = (peer: string, origin: string | undefined, url: string) => authorizedConnection(peer, origin, url, local, ['https://pwa.example'], 'secret');
  assert.equal(allow('::ffff:192.168.2.15', 'https://pwa.example', '/?token=secret'), true);
  for (const peer of ['8.8.8.8', '192.168.3.15', '127.0.0.1']) assert.equal(allow(peer, 'https://pwa.example', '/?token=secret'), false);
  assert.equal(allow('192.168.2.15', 'https://evil.example', '/?token=secret'), false);
  assert.equal(allow('192.168.2.15', undefined, '/?token=secret'), false);
  assert.equal(allow('192.168.2.15', 'https://pwa.example', '/?token=wrong'), false);
});
