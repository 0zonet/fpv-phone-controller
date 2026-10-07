import type { VirtualController } from './virtual-controller.js';
import { safeAxes, type VirtualControllerAxes } from './virtual-controller.types.js';

/** Test double; never exposes a Windows device. */
export class FakeVirtualController implements VirtualController {
  connected = false;
  axes: VirtualControllerAxes = safeAxes();
  readonly updates: VirtualControllerAxes[] = [];
  readonly calls: string[] = [];
  async connect(): Promise<void> { this.calls.push('connect'); this.connected = true; }
  async disconnect(): Promise<void> { this.calls.push('disconnect'); this.connected = false; }
  updateAxes(axes: VirtualControllerAxes): void {
    if (!this.connected) throw new Error('Fake controller is disconnected.');
    this.axes = { ...axes }; this.updates.push(this.axes);
  }
  reset(): void { this.calls.push('reset'); this.updateAxes(safeAxes()); }
}
