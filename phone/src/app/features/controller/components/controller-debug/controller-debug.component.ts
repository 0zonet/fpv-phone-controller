import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ControllerState } from '../../../../core/models/controller-state.model';

@Component({
  selector: 'app-controller-debug', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './controller-debug.component.html', styleUrl: './controller-debug.component.css'
})
export class ControllerDebugComponent {
  readonly state = input.required<ControllerState>();
  readonly rows = computed(() => {
    const state = this.state();
    return [
      { name: 'Yaw', value: state.yaw.toFixed(3) },
      { name: 'Throttle', value: state.throttle.toFixed(3) },
      { name: 'Roll', value: state.roll.toFixed(3) },
      { name: 'Pitch', value: state.pitch.toFixed(3) }
    ];
  });
}
