import type { VirtualControllerAxes } from './virtual-controller.types.js';

export interface VirtualController {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  updateAxes(axes: VirtualControllerAxes): void;
  reset(): void;
}
