import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ControllerIconComponent } from '../../components/controller-icon/controller-icon.component';
import { environment } from '../../../../../environments/environment';
import { ControllerStateService } from '../../../../core/services/controller-state.service';
import { ControllerTransportService } from '../../../../core/services/controller-transport.service';
import { ControllerTransmissionService } from '../../../../core/services/controller-transmission.service';
import { VirtualStickComponent } from '../../components/virtual-stick/virtual-stick.component';
import { ControllerDebugComponent } from '../../components/controller-debug/controller-debug.component';
import { ConnectionStatusComponent } from '../../components/connection-status/connection-status.component';

@Component({
  selector: 'app-controller-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ControllerTransmissionService],
  imports: [VirtualStickComponent, ControllerDebugComponent, ConnectionStatusComponent, ControllerIconComponent],
  host: { '(document:fullscreenchange)': 'syncFullscreen()' },
  templateUrl: './controller-page.component.html', styleUrl: './controller-page.component.css'
})
export class ControllerPageComponent {
  readonly controller = inject(ControllerStateService);
  readonly transport = inject(ControllerTransportService);
  private readonly transmission = inject(ControllerTransmissionService);
  readonly address = signal(this.readAddress());
  readonly fullscreenMessage = signal('');
  readonly fullscreen = signal(!!document.fullscreenElement);
  readonly settingsOpen = signal(false);
  readonly debugOpen = signal(false);
  readonly showConnection = computed(() => this.transport.status() !== 'connected' || this.settingsOpen());
  readonly throttlePercent = computed(() => Math.round(this.controller.state().throttle * 100));

  updateAddress(value: string): void { this.address.set(value); }
  connect(): void {
    const address = this.address().trim();
    try { localStorage.setItem('fpv-controller-address', address); } catch { /* Storage may be disabled. */ }
    this.transport.connect(address);
    this.settingsOpen.set(false);
  }
  disconnect(): void { this.transport.disconnect(); }
  private readAddress(): string {
    try { const stored = localStorage.getItem('fpv-controller-address'); if (stored) return stored; } catch { /* Use host fallback. */ }
    return environment.defaultWebSocketEndpoint;
  }

  syncFullscreen(): void {
    const active = !!document.fullscreenElement;
    this.fullscreen.set(active);
    if (!active) {
      screen.orientation?.unlock();
      this.fullscreenMessage.set('');
    }
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      this.syncFullscreen();
      this.fullscreenMessage.set('');
    } catch {
      this.fullscreenMessage.set('Este navegador no permite pantalla completa. Puedes seguir usando el mando aquí.');
      return;
    }
    if (document.fullscreenElement) {
      const orientation: ScreenOrientation & { lock?: (mode: 'landscape') => Promise<void> } = screen.orientation;
      try {
        if (!orientation?.lock) throw new Error('Orientation lock unavailable');
        await orientation.lock('landscape');
        if (!document.fullscreenElement) orientation.unlock();
      } catch {
        if (document.fullscreenElement) {
          this.fullscreenMessage.set('Gira el teléfono a horizontal: este navegador no permite bloquear la orientación.');
        }
      }
    }
  }
}
