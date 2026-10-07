import { effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PairingService } from './pairing.service';
import { ControllerTransportService } from './controller-transport.service';

@Injectable()
export class PairingFlowService implements OnDestroy {
  private readonly parser = inject(PairingService);
  private readonly transport = inject(ControllerTransportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private endpoint = '';
  private completed = false;
  private attempted = false;
  private readonly failed = signal(false);
  readonly canRetry = signal(false);
  readonly error = this.failed.asReadonly();

  constructor() {
    effect(() => {
      const status = this.transport.status();
      if (this.completed || !this.attempted) return;
      if (status === 'connected') {
        this.completed = true;
        void this.router.navigateByUrl('/', { replaceUrl: true });
      } else if (status === 'error' || status === 'disconnected') this.failed.set(true);
    });
    try {
      const data = this.route.snapshot.queryParamMap.getAll('data');
      if (data.length !== 1 || this.route.snapshot.queryParamMap.keys.some(key => key !== 'data')) throw new Error('Invalid pairing');
      this.endpoint = this.parser.parsePairingUrl(new URL('/connect?data=' + encodeURIComponent(data[0]), window.location.origin).href);
      this.canRetry.set(true);
      this.retry();
    } catch { this.failed.set(true); }
  }
  retry(): void {
    if (!this.endpoint) return;
    this.attempted = true;
    this.failed.set(false);
    try { localStorage.setItem('fpv-controller-address', this.endpoint); } catch { /* Storage may be disabled. */ }
    this.transport.connect(this.endpoint);
  }
  manual(): void { this.transport.disconnect(); void this.router.navigateByUrl('/', { replaceUrl: true }); }
  ngOnDestroy(): void { if (!this.completed && this.transport.status() === 'connecting') this.transport.disconnect(); }
}
