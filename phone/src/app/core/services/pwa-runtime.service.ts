import { Injectable, OnDestroy, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class PwaRuntimeService implements OnDestroy {
  private readonly media = window.matchMedia('(display-mode: standalone)');
  private readonly fullscreen = window.matchMedia('(display-mode: fullscreen)');
  readonly displayMode = signal(this.media.matches ? 'standalone' : this.fullscreen.matches ? 'fullscreen' : 'browser');
  readonly workerActive = signal(false);
  private destroyed = false;
  private readonly updateMode = (): void => { this.displayMode.set(this.media.matches ? 'standalone' : this.fullscreen.matches ? 'fullscreen' : 'browser'); };
  private readonly updateWorker = (): void => {
    void navigator.serviceWorker.getRegistration().then(registration => {
      if (!this.destroyed) this.workerActive.set(registration?.active?.state === 'activated');
    }).catch(() => {});
  };
  constructor() {
    this.media.addEventListener('change', this.updateMode);
    this.fullscreen.addEventListener('change', this.updateMode);
    if ('serviceWorker' in navigator) {
      this.updateWorker();
      navigator.serviceWorker.addEventListener('controllerchange', this.updateWorker);
      void navigator.serviceWorker.ready.then(() => { if (!this.destroyed) this.updateWorker(); });
    }
  }
  ngOnDestroy(): void {
    this.destroyed = true; this.media.removeEventListener('change', this.updateMode);
    this.fullscreen.removeEventListener('change', this.updateMode);
    if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', this.updateWorker);
  }
}
