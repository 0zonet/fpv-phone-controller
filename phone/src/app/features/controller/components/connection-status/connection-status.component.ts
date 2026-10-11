import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ConnectionStatus } from '../../../../core/models/connection-status.model';

@Component({
  selector: 'app-connection-status', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span role="status" [class]="status()"><i aria-hidden="true"></i>{{ label() }}</span>',
  styles: [`
    span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; color: #a0b3c3; font-size: 11px; }
    i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .connected { color: #4ce3b2; } .connecting { color: #ffd27c; } .error { color: #ffadad; }
  `]
})
export class ConnectionStatusComponent {
  readonly status = input<ConnectionStatus>('disconnected');
  readonly lost = input(false);
  readonly label = computed(() => this.lost() ? 'Conexión perdida' : ({
    connected: 'Conectado', connecting: 'Conectando…', disconnected: 'Sin conexión', error: 'No se pudo conectar'
  })[this.status()]);
}
