import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { usefulAddresses } from '../desktop/dist/desktop/src/network/local-network.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'dist/windows');
const host = usefulAddresses()[0]?.address;
assert.ok(host, 'A useful local interface is required for packaged network tests');
function start(port, name, expectedError = '') {
  const child = spawn(join(directory, 'runtime/companion-engine.exe'), [join(directory,'companion.cjs'),'--smoke-test'], {
    cwd: directory, env: {...process.env, FPV_BIND_ADDRESS:host, PORT:String(port), FPV_DATA_DIR:join(root,'work','startup-' + name + '-' + Date.now()),
      NODE_OPTIONS:'',NODE_PATH:'',PATH:join(process.env.WINDIR,'System32') + ';' + process.env.WINDIR},
    stdio:['pipe','pipe','pipe'], windowsHide:true
  });
  let resolveReady, rejectReady, stderr = '';
  const ready = new Promise((resolve,reject) => {resolveReady=resolve;rejectReady=reject;});
  const timer = setTimeout(() => {child.kill();rejectReady(new Error('Startup timeout: ' + stderr));},10000);
  child.stderr.on('data', chunk => {stderr += chunk;});
  createInterface({input:child.stdout}).on('line', line => {
    const state=JSON.parse(line);
    if (state.websocket === 'LISTENING' || (expectedError && state.issueCode === expectedError)) {clearTimeout(timer);resolveReady(state);}
    else if (state.type === 'fatal' || state.message) {clearTimeout(timer);rejectReady(new Error(state.message));}
  });
  const exit = new Promise((resolve,reject) => {
    child.once('exit', code => {clearTimeout(timer);if(code !== 0) reject(new Error('Exit ' + code));else resolve(code);});
    child.once('error', error => {clearTimeout(timer);rejectReady(error);reject(error);});
  });
  exit.catch(() => {});
  return {child,ready,exit};
}
async function stop(process) {
  process.child.stdin.write('shutdown\n');
  await Promise.race([process.exit,new Promise((_,reject)=>{const timer=setTimeout(()=>{process.child.kill();reject(new Error('Shutdown timeout'));},5000);timer.unref();})]);
}
const blocker=createServer(socket=>socket.destroy());
await new Promise(resolve=>blocker.listen(0,host,resolve));
const port=blocker.address().port;
let active;
try {
  active=start(port,'occupied','PORT_BUSY');
  const issue=await active.ready;
  assert.equal(issue.health.port,'Not available');assert.equal(issue.health.websocket,'Not available');
  assert.match(issue.message,/Port already in use/);assert.doesNotMatch(issue.message,/stack|Error:| at /);
  await active.exit;
  await new Promise(resolve=>blocker.close(resolve));
  active=start(port,'first');
  const first=await active.ready;await stop(active);
  active=start(port,'regenerated');
  const second=await active.ready;
  assert.notEqual(first.pairingUrl,second.pairingUrl);
  const old=first.addresses.find(entry=>entry.address===first.selectedAddress).endpoint;
  const current=second.addresses.find(entry=>entry.address===second.selectedAddress).endpoint;
  const origin=new URL(second.pairingUrl).origin;
  await new Promise((resolve,reject)=>{
    const socket=new WebSocket(old,{origin});
    socket.once('open',()=>{socket.close();reject(new Error('Old token accepted'));});
    socket.once('error',error=>/401|403/.test(error.message)?resolve():reject(error));
  });
  await new Promise((resolve,reject)=>{
    const socket=new WebSocket(current,{origin});
    socket.once('open',()=>socket.close());socket.once('close',resolve);socket.once('error',reject);
  });
  await stop(active);
  console.log('PASS: actual occupied port, actionable UI message, restart/regenerated QR, old token rejection and new pairing.');
} finally {
  if(active?.child.exitCode===null) active.child.kill();
  if(blocker.listening) await new Promise(resolve=>blocker.close(resolve));
}
