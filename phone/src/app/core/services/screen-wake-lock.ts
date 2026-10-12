/** Minimal shape of the Screen Wake Lock API, so tests can provide a fake. */
export interface WakeLockSentinelLike { release(): Promise<void>; addEventListener(type: 'release', listener: () => void): void; }
export interface WakeLockHost {
  request(): Promise<WakeLockSentinelLike>;
  hidden(): boolean;
}

/**
 * Keeps the screen on while `wanted` is true. The browser drops the lock when the page is hidden,
 * so `visibilityChanged()` requests it again. Failures (unsupported, low battery) are ignored.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinelLike | null = null;
  private wanted = false;
  private pending = false;
  constructor(private readonly host: WakeLockHost | null) {}
  get held(): boolean { return this.sentinel !== null; }
  set(wanted: boolean): void {
    this.wanted = wanted;
    if (wanted) void this.acquire(); else this.release();
  }
  visibilityChanged(): void { if (this.wanted && !this.host?.hidden()) void this.acquire(); }
  private async acquire(): Promise<void> {
    if (!this.host || this.sentinel || this.pending || this.host.hidden()) return;
    this.pending = true;
    try {
      const sentinel = await this.host.request();
      if (!this.wanted) { void sentinel.release().catch(() => {}); return; }
      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => { if (this.sentinel === sentinel) this.sentinel = null; });
    } catch { /* Not supported or not allowed right now. */ }
    finally { this.pending = false; }
  }
  private release(): void {
    const sentinel = this.sentinel; this.sentinel = null;
    void sentinel?.release().catch(() => {});
  }
}

export function browserWakeLockHost(): WakeLockHost | null {
  const api = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
  return api ? { request: () => api.request('screen'), hidden: () => document.hidden } : null;
}
