import type { VirtualControllerAxes } from './virtual-controller.types.js';

/** Published in the status JSON as `device`. */
export interface VirtualDeviceInfo { readonly id: number; readonly axes: number; readonly buttons: number; }
export interface VirtualController {
  /** Present while connected. */
  readonly device?: VirtualDeviceInfo;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  updateAxes(axes: VirtualControllerAxes): void;
  updateButtons(buttons: readonly boolean[]): void;
  reset(): void;
}
