import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neutralButtons } from '../../../../../shared/src/index';
import { applyStickSettings, DEFAULT_SETTINGS, parseSettings, SETTINGS_STORAGE_KEY } from '../models/settings.model';
import { SETTINGS_STORAGE, SettingsService, type SettingsStorage } from './settings.service';

class MemoryStorage implements SettingsStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}
const create = (storage: SettingsStorage | null) => runInInjectionContext(
  Injector.create({ providers: [{ provide: SETTINGS_STORAGE, useValue: storage }] }), () => new SettingsService());
const state = { throttle: .25, yaw: .5, pitch: -.5, roll: .02, buttons: neutralButtons() };

test('por defecto no cambia nada de lo que ya hace el PC (D2: todo en off)', () => {
  assert.equal(DEFAULT_SETTINGS.deadzone, 0);
  assert.ok(Object.values(DEFAULT_SETTINGS.invert).every(value => !value));
  assert.equal(applyStickSettings(state, DEFAULT_SETTINGS), state);
  assert.equal(DEFAULT_SETTINGS.buttons.length, 8);
});
test('zona muerta adicional solo en ejes centrados, reescalada; inversión por eje', () => {
  const sent = applyStickSettings(state, { deadzone: .1, invert: { yaw: false, throttle: false, roll: false, pitch: true } });
  assert.equal(sent.throttle, .25); assert.equal(sent.roll, 0);
  assert.ok(Math.abs(sent.yaw - (.4 / .9)) < 1e-12); assert.ok(Math.abs(sent.pitch - (.4 / .9)) < 1e-12);
  const thr = applyStickSettings(state, { deadzone: 0, invert: { yaw: true, throttle: true, roll: false, pitch: false } });
  assert.equal(thr.throttle, .75); assert.equal(thr.yaw, -.5);
  assert.equal(applyStickSettings({ ...state, yaw: 1 }, { deadzone: .25, invert: DEFAULT_SETTINGS.invert }).yaw, 1);
});
test('persiste en fpv-settings-v1 y lo recupera', () => {
  const storage = new MemoryStorage();
  const settings = create(storage);
  settings.setDeadzone(.08); settings.toggleInvert('pitch'); settings.setLiveValues(false);
  settings.setButtonLabel(4, '  FLIP  '); settings.setButtonMode(4, 'momentary');
  const stored = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
  assert.equal(stored.version, 1);
  const again = create(storage).settings();
  assert.equal(again.deadzone, .08); assert.equal(again.invert.pitch, true); assert.equal(again.liveValues, false);
  assert.deepEqual(again.buttons[4], { index: 4, label: 'FLIP', mode: 'momentary' });
  settings.reset(); assert.deepEqual(create(storage).settings(), DEFAULT_SETTINGS);
});
test('valores guardados inválidos o de otra versión vuelven a los valores por defecto', () => {
  assert.equal(parseSettings(null), DEFAULT_SETTINGS);
  assert.equal(parseSettings({ version: 2, deadzone: .2 }), DEFAULT_SETTINGS);
  const parsed = parseSettings({ version: 1, deadzone: 9, invert: { pitch: 'yes' }, liveValues: 'x',
    buttons: [{ label: '', mode: 'hold' }, { label: 'A\u0000VERYLONGLABEL', mode: 'toggle' }] });
  assert.equal(parsed.deadzone, .25); assert.equal(parsed.invert.pitch, false); assert.equal(parsed.liveValues, true);
  assert.deepEqual(parsed.buttons[0], DEFAULT_SETTINGS.buttons[0]);
  assert.deepEqual(parsed.buttons[1], { index: 1, label: 'AVERYLON', mode: 'toggle' });
  const broken = new MemoryStorage(); broken.setItem(SETTINGS_STORAGE_KEY, '{not json');
  assert.equal(create(broken).settings(), DEFAULT_SETTINGS);
});
test('sin almacenamiento disponible funciona en memoria', () => {
  const settings = create(null); settings.setDeadzone(.1); assert.equal(settings.settings().deadzone, .1);
  const throwing: SettingsStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
  const fallback = create(throwing); fallback.toggleInvert('yaw'); assert.equal(fallback.settings().invert.yaw, true);
});
