import type { ControllerAxes } from '../../../shared/src/index.js';

export type ControllerState = Readonly<ControllerAxes>;
/** Driver-independent: throttle 0..1, other axes -1..1. */
export interface VirtualControllerAxes {
  readonly throttle: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
}
export interface MapperOptions {
  readonly calibration: Readonly<Record<keyof VirtualControllerAxes, AxisCalibration>>;
}
/** Input-space endpoints; throttle center is metadata, not an autocenter. */
export interface AxisCalibration {
  readonly min: number;
  readonly max: number;
  readonly center: number;
  readonly invert: boolean;
  /** Fraction of normalized travel around the center, in [0, 1). */
  readonly deadzone: number;
}
export function safeAxes(): VirtualControllerAxes { return { throttle: 0, yaw: 0, pitch: 0, roll: 0 }; }
