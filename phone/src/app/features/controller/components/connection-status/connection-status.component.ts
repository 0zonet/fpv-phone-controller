import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ConnectionStatus } from '../../../../core/models/connection-status.model';
import { ControllerIconComponent } from '../controller-icon/controller-icon.component';

/** Five visible states: idle, connecting, connected, lost and failed (error without lost). */
export type PillState = 'idle' | 'connecting' | 'connected' | 'lost' | 'failed';
export function pillState(status: ConnectionStatus, lost: boolean): PillState {
  if (lost) return 'lost';
  return status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : status === 'error' ? 'failed' : 'idle';
}

/** Solid background, no backdrop-filter: it sits above the sticks while flying. */
@Component({
  selector: 'app-connection-status', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ControllerIconComponent],
  template: `<div [class]="'pill ' + state()">
    <span class="dot" aria-hidden="true"></span>
    <span class="label" role="status">{{ label() }}</span>
    @if (state() === 'connected') {
      <span class="metrics">{{ rate() }} Hz · {{ latency() === null ? '—' : latency() }} ms</span>
      <button type="button" aria-label="Desconectar" title="Desconectar" (click)="disconnect.emit()"><app-controller-icon name="power" /></button>
    }
  </div>`,
  styles: [`
    :host { display: inline-flex; min-width: 0; }
    .pill { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; box-sizing: border-box; border-radius: var(--fpv-radius-pill);
      background: var(--fpv-chip); border: 1px solid var(--fpv-chip-edge); color: var(--fpv-body); white-space: nowrap; min-width: 0; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fpv-muted); flex: none; }
    .label { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
    .metrics { font-family: var(--fpv-font-mono); font-size: 11px; color: var(--fpv-muted); margin: 0 2px; font-variant-numeric: tabular-nums; }
    .connected { background: var(--fpv-pill-solid); border-color: var(--fpv-edge); color: var(--fpv-ink); padding: 0 4px 0 14px; gap: 6px; }
    .connected .dot { background: var(--fpv-ok); box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.15); }
    .connecting { background: var(--fpv-warn-bg); border-color: var(--fpv-warn-edge); color: var(--fpv-warn); }
    .connecting .dot { background: var(--fpv-warn); }
    .lost, .failed { background: rgba(248, 113, 113, 0.12); border-color: rgba(248, 113, 113, 0.35); color: var(--fpv-error-text); }
    .lost .dot, .failed .dot { background: var(--fpv-error); }
    button { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%;
      background: var(--fpv-chip); color: var(--fpv-body); cursor: pointer; --icon-size: 16px; flex: none; }
    button:focus-visible { outline: 2px solid var(--fpv-ink); outline-offset: 2px; }
    @media (prefers-reduced-motion: no-preference) { button { transition: background-color .15s ease; } }
  `]
})
export class ConnectionStatusComponent {
  readonly status = input<ConnectionStatus>('disconnected');
  readonly lost = input(false);
  readonly rate = input(0);
  /** Round-trip time in ms, or null when the companion does not report it. */
  readonly latency = input<number | null>(null);
  /** Retrying after an unexpected close: shown as connecting, labelled Reconectando…. */
  readonly reconnecting = input(false);
  readonly disconnect = output<void>();
  readonly state = computed(() => this.reconnecting() ? 'connecting' : pillState(this.status(), this.lost()));
  readonly label = computed(() => this.reconnecting() ? 'Reconectando…' : ({
    idle: 'Sin conexión', connecting: 'Conectando…', connected: 'Conectado', lost: 'Conexión perdida', failed: 'No se pudo conectar'
  })[this.state()]);
}
