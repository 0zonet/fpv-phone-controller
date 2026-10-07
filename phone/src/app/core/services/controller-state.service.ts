import { computed, Injectable, signal } from '@angular/core';
import type { ControllerState } from '../models/controller-state.model';
import type { StickValue } from '../models/stick-state.model';

function bounded(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : Math.max(minimum, Math.min(maximum, 0));
}

@Injectable({ providedIn: 'root' })
export class ControllerStateService {
  private readonly values = signal<ControllerState>({ throttle: 0, yaw: 0, pitch: 0, roll: 0 });
  readonly throttle = computed(() => this.values().throttle);
  readonly yaw = computed(() => this.values().yaw);
  readonly pitch = computed(() => this.values().pitch);
  readonly roll = computed(() => this.values().roll);
  readonly state = computed<ControllerState>(() => this.values());
  readonly leftStick = computed<StickValue>(() => ({ x: this.yaw(), y: this.throttle() * 2 - 1 }));
  readonly rightStick = computed<StickValue>(() => ({ x: this.roll(), y: this.pitch() }));

  setLeftStick(value: StickValue): void {
    this.values.update(state => ({
      ...state, yaw: bounded(value.x, -1, 1), throttle: bounded((value.y + 1) / 2, 0, 1)
    }));
  }
  setRightStick(value: StickValue): void {
    this.values.update(state => ({ ...state, roll: bounded(value.x, -1, 1), pitch: bounded(value.y, -1, 1) }));
  }
  reset(): void { this.values.set({ throttle: 0, yaw: 0, pitch: 0, roll: 0 }); }
}
