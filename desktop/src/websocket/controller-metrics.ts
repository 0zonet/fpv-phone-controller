import type { ControllerMessage } from '../models/controller-message.js';

export class ControllerMetrics {
  latest: ControllerMessage | null = null;
  lastSequence: number | null = null;
  lostPackets = 0;
  receivedAt = 0;
  private receivedInWindow = 0;
  private windowStarted: number;
  constructor(now: number) { this.windowStarted = now; }
  receive(message: ControllerMessage, now: number): boolean {
    this.receivedInWindow += 1;
    if (this.lastSequence !== null && message.sequence <= this.lastSequence) return false;
    if (this.lastSequence !== null) this.lostPackets += message.sequence - this.lastSequence - 1;
    else this.lostPackets += message.sequence;
    this.lastSequence = message.sequence;
    this.latest = message;
    this.receivedAt = now;
    return true;
  }
  sampleRate(now: number): number {
    const elapsed = now - this.windowStarted;
    const rate = elapsed > 0 ? this.receivedInWindow * 1000 / elapsed : 0;
    this.windowStarted = now; this.receivedInWindow = 0;
    return rate;
  }
}
