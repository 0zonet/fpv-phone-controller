import { effect, inject, Injectable, OnDestroy, untracked } from '@angular/core';
import { ControllerStateService } from './controller-state.service';
import { ControllerTransportService } from './controller-transport.service';
import { ControllerTransmissionLoop } from './controller-transmission-loop';
import { TRANSPORT_CLOCK } from './transport-runtime';

@Injectable()
export class ControllerTransmissionService implements OnDestroy {
  private readonly state = inject(ControllerStateService);
  private readonly transport = inject(ControllerTransportService);
  private readonly loop = new ControllerTransmissionLoop(inject(TRANSPORT_CLOCK), () => this.transport.send(this.state.state()));
  constructor() {
    effect(() => {
      const connected = this.transport.status() === 'connected';
      untracked(() => { if (connected) this.loop.start(); else this.loop.stop(); });
    });
  }
  ngOnDestroy(): void { this.loop.stop(); this.transport.disconnect(); }
}
