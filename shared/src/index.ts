export interface ControlFrame {
  /** 0 = mínimo; 1 = máximo. */
  throttle: number;
  /** Ejes normalizados entre -1 y 1. */
  yaw: number;
  pitch: number;
  roll: number;
  /** Milisegundos Unix del celular. */
  timestamp: number;
}
export type ControllerAxes = Omit<ControlFrame, 'timestamp'>;
export const CONTROLLER_BUTTON_COUNT = 8;
/** Internal indices 0..7 correspond to vJoy buttons 1..8. */
export interface ControllerState extends ControllerAxes { readonly buttons: readonly boolean[]; }
export const neutralButtons = (): readonly boolean[] => Object.freeze(Array<boolean>(CONTROLLER_BUTTON_COUNT).fill(false));
export function isControllerButtons(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.length <= CONTROLLER_BUTTON_COUNT
    && Array.from(value).every(button => typeof button === 'boolean');
}
export function normalizeButtons(buttons: readonly boolean[] = []): readonly boolean[] {
  if (!isControllerButtons(buttons)) throw new Error('Buttons must contain at most eight booleans.');
  return Object.freeze(Array.from({ length: CONTROLLER_BUTTON_COUNT }, (_, index) => buttons[index] ?? false));
}
export interface ControllerMessage {
  readonly type: 'controller-state';
  readonly sequence: number;
  /** Milisegundos Unix del emisor; no implica relojes sincronizados. */
  readonly timestamp: number;
  readonly axes: ControllerAxes;
  /** Absent on legacy clients; treated as all released. */
  readonly buttons?: readonly boolean[];
}
export const neutralControls = (): ControlFrame => ({ throttle: 0, yaw: 0, pitch: 0, roll: 0, timestamp: Date.now() });
export function isControlFrame(value: unknown): value is ControlFrame {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['throttle', 'yaw', 'pitch', 'roll', 'timestamp'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]))
    && (v.throttle as number) >= 0 && (v.throttle as number) <= 1
    && ['yaw', 'pitch', 'roll'].every(k => Math.abs(v[k] as number) <= 1)
    && (v.timestamp as number) >= 0;
}
