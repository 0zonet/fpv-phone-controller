import type { TransportClock } from './transport-runtime';

export class ControllerTransmissionLoop {
  private readonly period = 1000 / 60;
  private cancel: (() => void) | undefined;
  private running = false;
  private next = 0;

  constructor(private readonly clock: TransportClock, private readonly transmit: () => void) {}
  start(): void {
    if (this.running) return;
    this.running = true;
    this.next = this.clock.now() + this.period;
    this.queue();
  }
  stop(): void { this.running = false; this.cancel?.(); this.cancel = undefined; }
  private queue(): void {
    this.cancel = this.clock.schedule(() => {
      if (!this.running) return;
      // Timers can wake slightly early; maintain the deadline without sending early.
      if (this.clock.now() < this.next) { this.queue(); return; }
      this.transmit();
      if (!this.running) return;
      this.next += this.period;
      if (this.next <= this.clock.now()) this.next = this.clock.now() + this.period;
      this.queue();
    }, Math.max(1, this.next - this.clock.now()));
  }
}
