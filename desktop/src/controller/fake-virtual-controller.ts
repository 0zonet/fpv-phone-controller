import { neutralButtons, normalizeButtons } from '../../../shared/src/index.js';
import type { VirtualController, VirtualDeviceInfo } from './virtual-controller.js';
import { safeAxes, type VirtualControllerAxes } from './virtual-controller.types.js';

/** Test double; never exposes a Windows device. */
export class FakeVirtualController implements VirtualController {
  buttons = neutralButtons();
  readonly buttonUpdates: (readonly boolean[])[] = [];
  connected = false;
  axes: VirtualControllerAxes = safeAxes();
  readonly updates: VirtualControllerAxes[] = [];
  readonly calls: string[] = [];
  get device(): VirtualDeviceInfo | undefined { return this.connected ? { id: 1, axes: 4, buttons: 8 } : undefined; }
  async connect(): Promise<void> { this.calls.push('connect'); this.connected = true; }
  async disconnect(): Promise<void> { this.calls.push('disconnect'); this.connected = false; }
  updateAxes(axes: VirtualControllerAxes): void {
    if (!this.connected) throw new Error('Fake controller is disconnected.');
    this.axes = { ...axes }; this.updates.push(this.axes);
  }
  updateButtons(buttons: readonly boolean[]): void {
    if (!this.connected) throw new Error('Fake controller is disconnected.');
    this.buttons = normalizeButtons(buttons); this.buttonUpdates.push(this.buttons);
  }
  reset(): void { this.calls.push('reset'); this.updateAxes(safeAxes()); this.updateButtons(neutralButtons()); }
}
