import type { ControllerState, MapperOptions, VirtualControllerAxes } from './virtual-controller.types.js';

export class ControllerMapper {
  constructor(private readonly options: MapperOptions) {
    for (const [axis, calibration] of Object.entries(options.calibration)) {
      const { min, max, center, deadzone } = calibration;
      if (![min, max, center, deadzone].every(Number.isFinite) || min >= max ||
        center < min || center > max || (axis !== 'throttle' && (center === min || center === max)) ||
        deadzone < 0 || deadzone >= 1) throw new Error('Invalid calibration for ' + axis);
    }
  }
  map(state: ControllerState): VirtualControllerAxes {
    return {
      throttle: this.mapAxis(state.throttle, 'throttle', true),
      yaw: this.mapAxis(state.yaw, 'yaw'), pitch: this.mapAxis(state.pitch, 'pitch'), roll: this.mapAxis(state.roll, 'roll')
    };
  }
  private mapAxis(value: number, axis: keyof VirtualControllerAxes, unsigned = false): number {
    if (!Number.isFinite(value)) return 0;
    const calibration = this.options.calibration[axis];
    const min = calibration.min;
    const max = calibration.max;
    const center = calibration.center;
    const clamped = Math.max(min, Math.min(max, value));
    const normalized = unsigned ? (clamped - min) / (max - min)
      : (clamped - center) / (clamped >= center ? max - center : center - min);
    const invert = calibration.invert;
    const inverted = invert ? (unsigned ? 1 - normalized : -normalized) : normalized;
    if (unsigned) return inverted;
    const deadzone = calibration.deadzone;
    const magnitude = Math.abs(inverted);
    return magnitude <= deadzone ? 0 : Math.sign(inverted) * (magnitude - deadzone) / (1 - deadzone);
  }
}
