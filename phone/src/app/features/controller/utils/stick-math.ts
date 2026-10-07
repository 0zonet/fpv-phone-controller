import type { StickValue } from '../../../core/models/stick-state.model';

export interface StickBounds { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }
export interface ReturnPolicy { readonly x: boolean; readonly y: boolean; }
export const TRAVEL_RATIO = 0.34;

export function clamp(value: number, minimum = -1, maximum = 1): number {
  if (minimum > maximum) throw new RangeError('Minimum exceeds maximum');
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : Math.max(minimum, Math.min(maximum, 0));
}
export function limitToCircle(value: StickValue, radius = 1): StickValue {
  if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Invalid radius');
  const x = Number.isFinite(value.x) ? value.x : 0;
  const y = Number.isFinite(value.y) ? value.y : 0;
  const length = Math.hypot(x, y);
  const scale = length > radius ? radius / length : 1;
  return { x: x * scale, y: y * scale };
}
export function normalize(value: number, radius: number): number {
  return radius > 0 && Number.isFinite(radius) ? value / radius : 0;
}
export function pointerToValue(clientX: number, clientY: number, bounds: StickBounds, invertY = true): StickValue {
  const radius = Math.min(bounds.width, bounds.height) * TRAVEL_RATIO;
  return limitToCircle({
    x: normalize(clientX - bounds.left - bounds.width / 2, radius),
    y: normalize(clientY - bounds.top - bounds.height / 2, radius) * (invertY ? -1 : 1)
  });
}
export function valueToVisual(value: StickValue, invertY = true): StickValue {
  const circular = limitToCircle(value);
  return { x: 50 + circular.x * TRAVEL_RATIO * 100, y: 50 + circular.y * TRAVEL_RATIO * 100 * (invertY ? -1 : 1) };
}
export function releaseValue(value: StickValue, policy: ReturnPolicy): StickValue {
  return limitToCircle({ x: policy.x ? 0 : value.x, y: policy.y ? 0 : value.y });
}
