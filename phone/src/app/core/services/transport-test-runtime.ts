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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners = new Map<string, ((event?: any) => void)[]>();
  send(data: string): void { if (this.failSend) throw new Error('Disconnected'); this.messages.push(data); }
  /** Default 1006 = abnormal closure, as when the PC or the network goes away. */
  close(code = 1006): void { if (this.readyState === 3) return; this.readyState = 3; this.fire('close', { code }); }
  open(): void { this.readyState = 1; this.fire('open'); }
  error(): void { this.fire('error'); }
  /** A PC → phone message. */
  receive(message: object | string): void { this.fire('message', { data: typeof message === 'string' ? message : JSON.stringify(message) }); }
  addEventListener(type: 'open' | 'error', callback: () => void): void;
  addEventListener(type: 'close', callback: (event: { readonly code: number }) => void): void;
  addEventListener(type: 'message', callback: (event: { readonly data: unknown }) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, callback: (event?: any) => void): void {
    const callbacks = this.listeners.get(type) ?? []; callbacks.push(callback); this.listeners.set(type, callbacks);
  }
  private fire(type: string, event?: object): void { for (const callback of this.listeners.get(type) ?? []) callback(event); }
}
