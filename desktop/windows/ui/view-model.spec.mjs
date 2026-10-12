import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chips, deviceText, maskEndpoint, problemFor, screen, stickOffsets, waitingNote } from './view-model.js';

const ready = { type: 'status', virtualController: 'READY', websocket: 'LISTENING', phone: 'DISCONNECTED', issueCode: '' };
const values = status => chips(status).map(chip => chip.value).join('|');

test('chips siguen el mapeo issueCode → chip', () => {
  assert.equal(values(null), 'Checking|Starting|Paused');
  assert.equal(values(ready), 'Ready|Ready|Waiting');
  assert.equal(values({ ...ready, phone: 'CONNECTED' }), 'Ready|Ready|Connected');
  assert.equal(values({ ...ready, issueCode: 'PHONE_LOST' }), 'Ready|Ready|Lost');
  assert.equal(values({ ...ready, issueCode: 'CONNECTION_HELP' }), 'Ready|Ready|Not reaching');
  assert.equal(values({ ...ready, issueCode: 'PAIRING_REJECTED' }), 'Ready|Ready|Old QR');
  const stopped = { ...ready, virtualController: 'NOT AVAILABLE', websocket: 'STOPPED' };
  assert.equal(values({ ...stopped, issueCode: 'DRIVER_MISSING' }), 'Driver needed|Paused|Paused');
  assert.equal(values({ ...stopped, issueCode: 'DRIVER_MISMATCH' }), 'Driver needed|Paused|Paused');
  assert.equal(values({ ...stopped, issueCode: 'DEVICE_UNAVAILABLE' }), 'Not configured|Paused|Paused');
  assert.equal(values({ ...stopped, issueCode: 'DEVICE_BUSY' }), 'Busy|Paused|Paused');
  assert.equal(values({ ...ready, websocket: 'STOPPED', issueCode: 'PORT_BUSY' }), 'Ready|Port busy|Paused');
  assert.equal(values({ ...stopped, issueCode: 'NETWORK_MISSING' }), 'Paused|No network|Paused');
  assert.equal(values({ ...ready, websocket: 'STOPPED', issueCode: 'NETWORK_PERMISSION' }), 'Ready|Blocked|Paused');
});
test('cada problema tiene su pantalla; los avisos suaves del teléfono no', () => {
  for (const [code, key] of [['DRIVER_MISSING', 'vjoy'], ['DRIVER_MISMATCH', 'vjoy'], ['DEVICE_UNAVAILABLE', 'vjoy'], ['DEVICE_BUSY', 'device'],
    ['PORT_BUSY', 'port'], ['NETWORK_MISSING', 'network'], ['NETWORK_PERMISSION', 'permission'], ['STARTUP_FAILED', 'startup'],
    ['QR_FAILED', 'startup'], ['FATAL', 'startup'], ['PAIRING_REJECTED', 'pairing']]) assert.equal(problemFor(code), key, code);
  for (const code of ['', 'PHONE_LOST', 'CONNECTION_HELP']) assert.equal(problemFor(code), null);
  assert.ok(waitingNote({ issueCode: 'PHONE_LOST' })); assert.ok(waitingNote({ issueCode: 'CONNECTION_HELP' }));
});
test('pantalla: QR, conectado, Show QR, pairing descartado y backend caído', () => {
  assert.deepEqual(screen(ready), { kind: 'qr', problem: null });
  assert.deepEqual(screen({ ...ready, phone: 'CONNECTED' }), { kind: 'connected', problem: null });
  assert.deepEqual(screen({ ...ready, phone: 'CONNECTED' }, { showQr: true }), { kind: 'qr', problem: null });
  assert.deepEqual(screen({ ...ready, issueCode: 'PAIRING_REJECTED' }), { kind: 'problem', problem: 'pairing' });
  assert.deepEqual(screen({ ...ready, issueCode: 'PAIRING_REJECTED' }, { dismissedPairing: true }), { kind: 'qr', problem: null });
  assert.deepEqual(screen(null), { kind: 'starting', problem: null });
  assert.deepEqual(screen(null, { backendStopped: true }), { kind: 'problem', problem: 'startup' });
});
test('endpoint enmascarado, dispositivo y mini sticks', () => {
  assert.equal(maskEndpoint('ws://192.168.1.2:8080/?token=' + 'a'.repeat(48)), 'ws://192.168.1.2:8080/?token=••••');
  assert.equal(maskEndpoint(undefined), '');
  assert.deepEqual(deviceText({ id: 1, axes: 4, buttons: 8 }), { text: '#1 · 4 axes · 8 buttons', warning: '' });
  assert.match(deviceText({ id: 3, axes: 4, buttons: 4 }).warning, /has 4 buttons; buttons above 4 are ignored/);
  assert.deepEqual(stickOffsets({ throttle: 1, yaw: -1, pitch: .5, roll: 2 }), { left: { x: -1, y: -1 }, right: { x: 1, y: .5 } });
  assert.deepEqual(stickOffsets(null), { left: { x: 0, y: 1 }, right: { x: 0, y: 0 } });
});
