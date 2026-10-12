import type { ControllerState } from './controller-state.model';
import { DEFAULT_CONTROLLER_BUTTONS, type ControllerButtonConfig, type VirtualButtonMode } from './controller-button.model';

export const SETTINGS_STORAGE_KEY = 'fpv-settings-v1';
export const MAX_DEADZONE = 0.25;
export const MAX_BUTTON_LABEL = 8;
export type AxisName = 'yaw' | 'throttle' | 'roll' | 'pitch';
export const AXIS_NAMES: readonly AxisName[] = ['yaw', 'throttle', 'roll', 'pitch'];

/**
 * Phone-side settings (D2): deadzone and inversion are applied on the phone, ON TOP of what the
 * PC already does (desktop/src/config.ts: 3 % deadzone on yaw/pitch/roll and pitch inverted).
 * All off = the behaviour before these settings existed.
 */
export interface FpvSettings {
  readonly version: 1;
  /** Additional deadzone for yaw, roll and pitch (centred axes), 0..0.25. */
  readonly deadzone: number;
  readonly invert: Readonly<Record<AxisName, boolean>>;
  readonly liveValues: boolean;
  /** Eight entries; index i = vJoy button i + 1. */
  readonly buttons: readonly ControllerButtonConfig[];
}

export const DEFAULT_BUTTONS: readonly ControllerButtonConfig[] = DEFAULT_CONTROLLER_BUTTONS;

export const DEFAULT_SETTINGS: FpvSettings = Object.freeze({
  version: 1, deadzone: 0, liveValues: true, buttons: DEFAULT_BUTTONS,
  invert: Object.freeze({ yaw: false, throttle: false, roll: false, pitch: false })
});

const isMode = (value: unknown): value is VirtualButtonMode => value === 'toggle' || value === 'momentary';
export function cleanLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_BUTTON_LABEL);
  return text || fallback;
}

/** Accepts any stored value; every invalid or missing field falls back to its default. */
export function parseSettings(raw: unknown): FpvSettings {
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 1) return DEFAULT_SETTINGS;
  const data = raw as Record<string, unknown>;
  const deadzone = typeof data['deadzone'] === 'number' && Number.isFinite(data['deadzone'])
    ? Math.min(MAX_DEADZONE, Math.max(0, data['deadzone'])) : DEFAULT_SETTINGS.deadzone;
  const invertRaw = (data['invert'] && typeof data['invert'] === 'object' ? data['invert'] : {}) as Record<string, unknown>;
  const invert = Object.fromEntries(AXIS_NAMES.map(axis => [axis, invertRaw[axis] === true])) as Record<AxisName, boolean>;
  const stored = Array.isArray(data['buttons']) ? data['buttons'] as unknown[] : [];
  const buttons = DEFAULT_BUTTONS.map((fallback, index) => {
    const entry = (stored[index] && typeof stored[index] === 'object' ? stored[index] : {}) as Record<string, unknown>;
    return { index, label: cleanLabel(entry['label'], fallback.label), mode: isMode(entry['mode']) ? entry['mode'] : fallback.mode };
  });
  return { version: 1, deadzone, invert, buttons,
    liveValues: typeof data['liveValues'] === 'boolean' ? data['liveValues'] : DEFAULT_SETTINGS.liveValues };
}

function centred(value: number, deadzone: number, invert: boolean): number {
  const signed = invert ? -value : value;
  const magnitude = Math.abs(signed);
  if (deadzone <= 0) return signed;
  return magnitude <= deadzone ? 0 : Math.sign(signed) * (magnitude - deadzone) / (1 - deadzone);
}
/** Axes actually sent to the PC. Buttons are untouched. */
export function applyStickSettings(state: ControllerState, settings: Pick<FpvSettings, 'deadzone' | 'invert'>): ControllerState {
  if (settings.deadzone <= 0 && !AXIS_NAMES.some(axis => settings.invert[axis])) return state;
  return {
    ...state,
    throttle: settings.invert.throttle ? 1 - state.throttle : state.throttle,
    yaw: centred(state.yaw, settings.deadzone, settings.invert.yaw),
    roll: centred(state.roll, settings.deadzone, settings.invert.roll),
    pitch: centred(state.pitch, settings.deadzone, settings.invert.pitch)
  };
}
