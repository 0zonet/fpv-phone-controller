import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
const require = createRequire(join(directory, 'companion.cjs'));
assert.equal(typeof require('koffi').load, 'function');
execFileSync(join(directory, 'FPVPhoneController.exe'), ['--self-test'], { timeout: 10000 });
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
  cwd: directory, env: { ...process.env, PORT: String(port), NODE_OPTIONS: '', NODE_PATH: '',
    PATH: join(process.env.WINDIR, 'System32') + ';' + process.env.WINDIR }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
});
let buffer = '', errors = '', connected = false, stopped = false;
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
  await denied(invalid.href, origin);
  socket = new WebSocket(endpoint, { origin: link.origin }); await waitOpen(socket);
  socket.send(JSON.stringify({ type: 'controller-state', sequence: 0, timestamp: Date.now(),
    axes: { throttle: .5, yaw: 0, pitch: 0, roll: 0 } }));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(connected);
  await new Promise(resolve => { socket.once('close', resolve); socket.close(); });
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.stdin.write('shutdown\n');
  const code = await Promise.race([exited, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error('Shutdown timeout')), 5000); timer.unref();
  })]);
  assert.equal(code, 0); assert.ok(stopped);
  console.log('PASS: native window, decoded QR, pairing route, packaged Koffi, PWA, LAN authorization, WebSocket, shutdown.');
} finally { clearTimeout(startup); socket?.terminate(); if (child.exitCode === null) child.kill(); }
