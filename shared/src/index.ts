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
export interface ControllerMessage {
  readonly type: 'controller-state';
  readonly sequence: number;
  /** Milisegundos Unix del emisor; no implica relojes sincronizados. */
  readonly timestamp: number;
  readonly axes: ControllerAxes;
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
