import type { VirtualController } from './virtual-controller.js';
import { safeAxes, type ControllerState, type VirtualControllerAxes } from './virtual-controller.types.js';
import { ControllerMapper } from './controller-mapper.js';

export interface FailsafeClock {
  now(): number;
  schedule(callback: () => void, delay: number): () => void;
}
const clock: FailsafeClock = {
  now: () => performance.now(),
  schedule: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return () => clearTimeout(timer); }
};

export class ControllerSession {
  private latestAxes: VirtualControllerAxes = safeAxes();
  private updates = 0;
  private sampledAt: number | undefined;
  private failsafe = false;
  sampleMetrics(): { updatesPerSecond: number; failsafe: boolean } {
    const now = this.timer.now();
    const elapsed = now - (this.sampledAt ?? this.startedAt);
    const updatesPerSecond = elapsed > 0 ? this.updates * 1000 / elapsed : 0;
    this.updates = 0; this.sampledAt = now;
    return { updatesPerSecond, failsafe: this.failsafe };
  }
  private readonly startedAt: number;
  get axes(): VirtualControllerAxes { return this.latestAxes; }
  private cancel: (() => void) | undefined;
  private deadline = 0;
  private active = false;
  private stopped = false;
  constructor(
    private readonly controller: VirtualController,
    private readonly mapper: ControllerMapper,
    private readonly failsafeMs: number,
    private readonly log: (message: string) => void,
    private readonly timer: FailsafeClock = clock,
    private readonly onError: (error: unknown) => void = error => { throw error; }
  ) {
    if (!Number.isFinite(failsafeMs) || failsafeMs <= 0) throw new Error('Invalid failsafeMs.');
    this.startedAt = this.timer.now();
  }
  receive(state: ControllerState): void {
    if (this.stopped) return;
    const axes = this.mapper.map(state);
    this.controller.updateAxes(axes); this.latestAxes = axes;
    this.updates += 1; this.failsafe = false;
    this.active = true; this.deadline = this.timer.now() + this.failsafeMs;
    if (!this.cancel) this.schedule();
  }
  disconnect(): void { this.activateFailsafe(); }
  stop(): void { this.stopped = true; this.cancel?.(); this.cancel = undefined; this.active = false; }
  private schedule(): void {
    this.cancel = this.timer.schedule(() => {
      this.cancel = undefined;
      if (this.stopped || !this.active) return;
      if (this.timer.now() < this.deadline) { this.schedule(); return; }
      try { this.activateFailsafe(); } catch (error) { this.onError(error); }
    }, Math.max(1, this.deadline - this.timer.now()));
  }
  private activateFailsafe(): void {
    this.cancel?.(); this.cancel = undefined;
    if (!this.active || this.stopped) return;
    this.active = false;
    // Reset bypasses mapping so inversion/deadzone cannot raise failsafe throttle.
    this.controller.reset(); this.latestAxes = safeAxes(); this.updates += 1; this.failsafe = true;
    this.log('FAILSAFE ACTIVE');
  }
}
