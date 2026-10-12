import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { VirtualButtonMode } from '../models/controller-button.model';
import { cleanLabel, DEFAULT_SETTINGS, MAX_DEADZONE, parseSettings, SETTINGS_STORAGE_KEY, type AxisName, type FpvSettings } from '../models/settings.model';

export interface SettingsStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
/** localStorage, or null when storage is disabled (private mode, policies). */
export const SETTINGS_STORAGE = new InjectionToken<SettingsStorage | null>('Settings storage', {
  providedIn: 'root', factory: () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
});

/** Versioned settings in localStorage under fpv-settings-v1. Every change is saved immediately. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(SETTINGS_STORAGE);
  private readonly value = signal<FpvSettings>(this.load());
  readonly settings = this.value.asReadonly();

  setDeadzone(value: number): void {
    if (!Number.isFinite(value)) return;
    this.update({ deadzone: Math.min(MAX_DEADZONE, Math.max(0, value)) });
  }
  toggleInvert(axis: AxisName): void {
    this.update({ invert: { ...this.value().invert, [axis]: !this.value().invert[axis] } });
  }
  setLiveValues(on: boolean): void { this.update({ liveValues: on }); }
  setButtonLabel(index: number, label: string): void { this.updateButton(index, button => ({ ...button, label: cleanLabel(label, DEFAULT_SETTINGS.buttons[index].label) })); }
  setButtonMode(index: number, mode: VirtualButtonMode): void { this.updateButton(index, button => ({ ...button, mode })); }
  reset(): void { this.value.set(DEFAULT_SETTINGS); this.save(); }

  private updateButton(index: number, change: (button: FpvSettings['buttons'][number]) => FpvSettings['buttons'][number]): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.value().buttons.length) return;
    this.update({ buttons: this.value().buttons.map((button, i) => i === index ? change(button) : button) });
  }
  private update(change: Partial<FpvSettings>): void { this.value.set(parseSettings({ ...this.value(), ...change })); this.save(); }
  private load(): FpvSettings {
    try { const raw = this.storage?.getItem(SETTINGS_STORAGE_KEY); return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS; }
    catch { return DEFAULT_SETTINGS; }
  }
  private save(): void {
    try { this.storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.value())); } catch { /* Quota or disabled storage: keep in memory. */ }
  }
}
