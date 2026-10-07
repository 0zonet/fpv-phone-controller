import type { ControllerMessage } from '../../../shared/src/index.js';
export type { ControllerMessage } from '../../../shared/src/index.js';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function inRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}
export function isControllerMessage(value: unknown): value is ControllerMessage {
  if (!record(value) || value['type'] !== 'controller-state' || !record(value['axes'])) return false;
  const axes = value['axes'];
  return inRange(value['sequence'], 0, Number.MAX_SAFE_INTEGER) && Number.isSafeInteger(value['sequence'])
    && inRange(value['timestamp'], 0, Number.MAX_SAFE_INTEGER)
    && inRange(axes['throttle'], 0, 1)
    && ['yaw', 'pitch', 'roll'].every(axis => inRange(axes[axis], -1, 1));
}
