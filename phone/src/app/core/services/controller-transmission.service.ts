import { effect, inject, Injectable, OnDestroy, untracked } from '@angular/core';
import { ControllerStateService } from './controller-state.service';
import { ControllerTransportService } from './controller-transport.service';
import { ControllerTransmissionLoop } from './controller-transmission-loop';
import { TRANSPORT_CLOCK } from './transport-runtime';
import { SettingsService } from './settings.service';
import { applyStickSettings } from '../models/settings.model';

/** Every connection and reconnection starts with all buttons OFF; leaving the connected state releases them too. */
export function syncTransmission(connected: boolean, loop: Pick<ControllerTransmissionLoop, 'start' | 'stop'>,
  state: Pick<ControllerStateService, 'resetButtons'>): void {
  if (connected) { state.resetButtons(); loop.start(); }
  else { loop.stop(); state.resetButtons(); }
}

@Injectable()
export class ControllerTransmissionService implements OnDestroy {
  private readonly state = inject(ControllerStateService);
  private readonly transport = inject(ControllerTransportService);
  private readonly settings = inject(SettingsService);
  /** Phone-side deadzone and inversion (D2) are applied to what is sent, not to the sticks. */
  private readonly loop = new ControllerTransmissionLoop(inject(TRANSPORT_CLOCK),
    () => this.transport.send(applyStickSettings(this.state.state(), this.settings.settings())));
  constructor() {
    effect(() => {
      const connected = this.transport.status() === 'connected';
      untracked(() => syncTransmission(connected, this.loop, this.state));
    });
  }
  ngOnDestroy(): void { this.loop.stop(); this.state.resetButtons(); this.transport.disconnect(); }
}
