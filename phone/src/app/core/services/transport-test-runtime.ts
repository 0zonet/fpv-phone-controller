import type { TransportClock, TransportSocket } from './transport-runtime';

export class FakeClock implements TransportClock {
  time = 0;
  private nextId = 0;
  readonly tasks = new Map<number, { deadline: number; callback: () => void }>();
  now(): number { return this.time; }
  timestamp(): number { return 1700000000000 + this.time; }
  schedule(callback: () => void, delay: number): () => void {
    const id = this.nextId++; this.tasks.set(id, { deadline: this.time + delay, callback });
    return () => { this.tasks.delete(id); };
  }
  advance(milliseconds: number): void {
    const end = this.time + milliseconds;
    for (;;) {
      const task = [...this.tasks.entries()].sort((a, b) => a[1].deadline - b[1].deadline)[0];
      if (!task || task[1].deadline > end) break;
      this.time = Math.max(this.time, task[1].deadline);
      this.tasks.delete(task[0]); task[1].callback();
    }
    this.time = end;
  }
}
export class FakeSocket implements TransportSocket {
  readyState = 0;
  bufferedAmount = 0;
  readonly messages: string[] = [];
  failSend = false;
  private readonly listeners = new Map<string, (() => void)[]>();
  send(data: string): void { if (this.failSend) throw new Error('Disconnected'); this.messages.push(data); }
  close(): void { this.readyState = 3; this.fire('close'); }
  open(): void { this.readyState = 1; this.fire('open'); }
  error(): void { this.fire('error'); }
  addEventListener(type: 'open' | 'close' | 'error', callback: () => void): void {
    const callbacks = this.listeners.get(type) ?? []; callbacks.push(callback); this.listeners.set(type, callbacks);
  }
  private fire(type: string): void { for (const callback of this.listeners.get(type) ?? []) callback(); }
}
