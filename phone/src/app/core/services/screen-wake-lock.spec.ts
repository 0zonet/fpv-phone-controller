import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScreenWakeLock, type WakeLockSentinelLike } from './screen-wake-lock';

function fakeHost() {
  const host = { hidden: false, requests: 0, releases: 0, listeners: [] as (() => void)[],
    request: async (): Promise<WakeLockSentinelLike> => {
      host.requests += 1;
      return { release: async () => { host.releases += 1; }, addEventListener: (_: 'release', listener: () => void) => { host.listeners.push(listener); } };
    } };
  return host;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('pide el wake lock al conectar y lo suelta al desconectar', async () => {
  const host = fakeHost(); const lock = new ScreenWakeLock({ request: host.request, hidden: () => host.hidden });
  lock.set(true); lock.set(true); await tick();
  assert.equal(host.requests, 1); assert.ok(lock.held);
  lock.set(false); await tick();
  assert.equal(host.releases, 1); assert.ok(!lock.held);
});
test('lo vuelve a pedir al regresar a primer plano si el navegador lo soltó', async () => {
  const host = fakeHost(); const lock = new ScreenWakeLock({ request: host.request, hidden: () => host.hidden });
  lock.set(true); await tick();
  host.hidden = true; host.listeners.forEach(listener => listener());
  assert.ok(!lock.held); lock.visibilityChanged(); await tick(); assert.equal(host.requests, 1);
  host.hidden = false; lock.visibilityChanged(); await tick();
  assert.equal(host.requests, 2); assert.ok(lock.held);
});
test('sin soporte o con fallo no lanza errores', async () => {
  const lock = new ScreenWakeLock(null); lock.set(true); lock.visibilityChanged(); lock.set(false);
  const failing = new ScreenWakeLock({ request: () => Promise.reject(new Error('NotAllowed')), hidden: () => false });
  failing.set(true); await tick(); assert.ok(!failing.held);
});
test('si se desconecta mientras la petición está en curso, suelta el lock recibido', async () => {
  const host = fakeHost(); const lock = new ScreenWakeLock({ request: host.request, hidden: () => host.hidden });
  lock.set(true); lock.set(false); await tick();
  assert.ok(!lock.held); assert.equal(host.releases, 1);
});
