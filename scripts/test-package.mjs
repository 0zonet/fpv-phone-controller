import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import jsQR from 'jsqr';
const sourceRequire = createRequire(import.meta.url);
const qrRequire = createRequire(sourceRequire.resolve('qrcode'));
const { PNG } = qrRequire('pngjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'dist/windows');
const dataDirectory = join(root, 'work/package-test-' + Date.now());
const require = createRequire(join(directory, 'companion.cjs'));
assert.equal(typeof require('koffi').load, 'function');
execFileSync(join(directory, 'FPVPhoneController.exe'), ['--self-test'], { timeout: 40000, env: { ...process.env, FPV_DATA_DIR: dataDirectory } });
const vJoySetup = await readFile(join(directory, 'vjoy/vJoySetup_v2.2.2.0_Win10_Win11.exe'));
assert.equal(createHash('sha256').update(vJoySetup).digest('hex'), 'ef569a3105cd301b89580f18f60c66b339e95296acf2c0dfcaf4b4bbf8ab68fe');
assert.match(await readFile(join(directory, 'licenses/vJoy-LICENSE.txt'), 'utf8'), /MIT License/);
// WebView2 window: SDK DLLs next to the exe, the HTML UI and its self-hosted fonts (no network needed).
for (const file of ['Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll', 'ui/index.html', 'ui/app.js', 'ui/view-model.js', 'ui/app.css',
  'ui/fonts/urbanist-latin-wght-normal.woff2', 'ui/fonts/doto-latin-wght-normal.woff2', 'ui/fonts/martian-mono-latin-wght-normal.woff2']) await access(join(directory, file));
await assert.rejects(access(join(directory, 'ui/demo.js')));
assert.match(await readFile(join(directory, 'licenses/WebView2-LICENSE.txt'), 'utf8'), /Redistribution and use in source and binary forms/);
// Probe never elevates: 0 = fitting device recorded, 10 = installer/Repair driver must run elevated.
const vJoyProbe = spawnSync(join(directory, 'runtime/companion-engine.exe'), [join(directory, 'vjoy-setup.cjs'), '--probe', '--state-dir', dataDirectory], { timeout: 30000, windowsHide: true });
assert.ok([0, 10].includes(vJoyProbe.status), 'vJoy probe exit ' + vJoyProbe.status);
if (vJoyProbe.status === 0) assert.ok(JSON.parse(await readFile(join(dataDirectory, 'vjoy-device.json'), 'utf8')).deviceId >= 1);
const manifest = JSON.parse(await readFile(join(directory, 'phone/manifest.webmanifest'), 'utf8'));
assert.equal(manifest.display, 'standalone'); assert.equal(manifest.orientation, 'landscape');
const ngsw = JSON.parse(await readFile(join(directory, 'phone/ngsw.json'), 'utf8'));
assert.ok(Object.keys(ngsw.hashTable).some(path => path.endsWith('.js')));
assert.ok(Object.keys(ngsw.hashTable).some(path => path.includes('icon-512')));
const probe = createServer();
await new Promise(resolve => probe.listen(0, resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const child = spawn(join(directory, 'runtime/companion-engine.exe'), [join(directory, 'companion.cjs'), '--smoke-test'], {
  cwd: directory, env: { ...process.env, FPV_DATA_DIR: dataDirectory, PORT: String(port), NODE_OPTIONS: '', NODE_PATH: '',
    PATH: join(process.env.WINDIR, 'System32') + ';' + process.env.WINDIR }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
});
let buffer = '', errors = '', connected = false, stopped = false, rejected = false;
const metrics = [];
let resolveReady, rejectReady;
const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
const startup = setTimeout(() => rejectReady(new Error('Packaged companion startup timeout: ' + errors)), 10000);
child.stderr.on('data', chunk => { errors += chunk.toString(); });
child.stdout.on('data', chunk => {
  buffer += chunk.toString();
  for (;;) {
    const end = buffer.indexOf('\n'); if (end < 0) break;
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    const state = JSON.parse(line);
    if (state.type === 'metrics') { metrics.push(state); continue; }
    if (state.issueCode === 'PAIRING_REJECTED' && state.phoneAttempted) rejected = true;
    if (state.phone === 'CONNECTED') connected = true;
    if (state.websocket === 'STOPPED' && state.virtualController === 'NOT AVAILABLE') stopped = true;
    if (state.websocket === 'LISTENING') resolveReady(state);
    if (state.type === 'fatal' || (state.message && state.websocket !== 'LISTENING')) rejectReady(new Error(state.message));
  }
});
child.once('error', rejectReady);
child.once('exit', code => { if (code !== 0) rejectReady(new Error('Companion exit ' + code + ': ' + errors)); });
const waitOpen = socket => new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
const denied = (url, origin) => new Promise((resolve, reject) => {
  const socket = new WebSocket(url, { origin });
  socket.once('open', () => { socket.close(); reject(new Error('Unauthorized connection accepted')); });
  socket.once('error', error => { if (/401|403/.test(error.message)) resolve(); else reject(error); });
});
let socket;
try {
  const state = await ready; clearTimeout(startup);
  const endpoint = state.addresses.find(entry => entry.address === state.selectedAddress).endpoint;
  const origin = state.localWebUrl;
  assert.equal(state.virtualController, 'READY');
  assert.ok(Object.values(state.health).every(value => value === 'Ready'));
  assert.equal(state.version, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version);
  const fixture = join(dataDirectory, 'status-fixture.json');
  await writeFile(fixture, JSON.stringify(state));
  try { execFileSync(join(directory, 'FPVPhoneController.exe'), ['--self-test', fixture], {timeout:40000, env: { ...process.env, FPV_DATA_DIR: dataDirectory }}); }
  finally { await rm(fixture); }
  const link = new URL(state.pairingUrl);
  assert.equal(link.pathname, '/connect');
  const payload = JSON.parse(Buffer.from(link.searchParams.get('data'), 'base64url').toString('utf8'));
  assert.equal(payload.version, 1); assert.equal(payload.host, state.selectedAddress); assert.equal(payload.port, port);
  assert.equal('ws://' + payload.host + ':' + payload.port + '/?token=' + payload.token, endpoint);
  const png = PNG.sync.read(Buffer.from(state.qrPngBase64, 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded?.data, state.pairingUrl, 'Actual QR must decode to the complete connection URL');
  const route = await fetch(origin + link.pathname + link.search);
  assert.equal(route.status, 200); assert.match(await route.text(), /manifest.webmanifest/);
  const page = await fetch(origin); assert.equal(page.status, 200);
  assert.match(await page.text(), /manifest.webmanifest/);
  await denied(endpoint, 'https://unauthorized.example');
  const invalid = new URL(endpoint); invalid.searchParams.set('token', 'wrong');
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(invalid.href, { origin });
    socket.once('close', code => code === 4003 ? resolve() : reject(new Error('Wrong token close code ' + code)));
    socket.once('error', reject);
  });
  socket = new WebSocket(endpoint, { origin: link.origin });
  const fromPc = [];
  socket.on('message', data => fromPc.push(JSON.parse(data.toString())));
  await waitOpen(socket);
  socket.send(JSON.stringify({ type: 'controller-state', sequence: 0, timestamp: Date.now(),
    axes: { throttle: .5, yaw: 0, pitch: 0, roll: 0 } }));
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(connected); assert.ok(rejected, 'Rejected pairing must be reported');
  assert.deepEqual(fromPc[0], { type: 'hello', protocol: 2, capabilities: ['ack', 'close-codes'] });
  assert.deepEqual(fromPc.find(message => message.type === 'ack'), { type: 'ack', sequence: 0 });
  const live = metrics.at(-1);
  assert.ok(live && metrics.length >= 2, 'metrics lines while connected');
  assert.equal(typeof live.packetsPerSecond, 'number'); assert.equal(live.axes.throttle, .5);
  const closedByPc = new Promise(resolve => socket.once('close', code => resolve(code)));
  child.stdin.write('disconnect-phone\n');
  assert.equal(await closedByPc, 4001);
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.stdin.write('shutdown\n');
  const code = await Promise.race([exited, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('Shutdown timeout')), 5000); timer.unref();
  })]);
  assert.equal(code, 0); assert.ok(stopped);
  const logText = await readFile(join(state.logsDirectory, 'companion.jsonl'), 'utf8');
  const events = logText.trim().split('\n').map(line => JSON.parse(line).event);
  for (const event of ['startup','driver_ready','network_selected','qr_generated','server_started','phone_attempted','pairing_rejected','phone_connected','phone_disconnect_requested','phone_disconnected','failsafe','shutdown']) assert.ok(events.includes(event), event);
  assert.ok(!logText.includes(payload.token)); assert.doesNotMatch(logText, /THR /);
  console.log('PASS: native QR UI, health, version, decoded QR, PWA route, authorized WebSocket, structured logs and shutdown.');
} finally { clearTimeout(startup); socket?.terminate(); if (child.exitCode === null) child.kill(); }
