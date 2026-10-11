import { VirtualButtonComponent } from '../../components/virtual-button/virtual-button.component';
import { DEFAULT_CONTROLLER_BUTTONS } from '../../../../core/models/controller-button.model';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ControllerIconComponent } from '../../components/controller-icon/controller-icon.component';
import { environment } from '../../../../../environments/environment';
import { ControllerStateService } from '../../../../core/services/controller-state.service';
import { ControllerTransportService } from '../../../../core/services/controller-transport.service';
import { ControllerTransmissionService } from '../../../../core/services/controller-transmission.service';
import { VirtualStickComponent } from '../../components/virtual-stick/virtual-stick.component';
import { ControllerDebugComponent } from '../../components/controller-debug/controller-debug.component';
import { ConnectionStatusComponent } from '../../components/connection-status/connection-status.component';
import { PRODUCT_VERSION } from '../../../../../../../shared/src/product-version';
import { validEndpoint, publicEndpoint, editEndpoint } from '../../../../core/services/connection-address';
import { PwaRuntimeService } from '../../../../core/services/pwa-runtime.service';

@Component({
  selector: 'app-controller-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ControllerTransmissionService],
  imports: [VirtualButtonComponent, VirtualStickComponent, ControllerDebugComponent, ConnectionStatusComponent, ControllerIconComponent],
  host: { '(document:fullscreenchange)': 'syncFullscreen()', '(window:blur)': 'controller.resetButtons()', '(document:visibilitychange)': 'clearHiddenButtons()' },
  templateUrl: './controller-page.component.html', styleUrl: './controller-page.component.css'
})
export class ControllerPageComponent {
  readonly buttonConfigs = DEFAULT_CONTROLLER_BUTTONS;
  clearHiddenButtons(): void { if (document.hidden) this.controller.resetButtons(); }
  readonly version = PRODUCT_VERSION;
  readonly controller = inject(ControllerStateService);
  readonly transport = inject(ControllerTransportService);
  private readonly transmission = inject(ControllerTransmissionService);
  readonly pwa = inject(PwaRuntimeService);
  private readonly endpoint = signal(this.readAddress());
  readonly paired = computed(() => !!validEndpoint(this.endpoint()));
  readonly manualAddress = signal(publicEndpoint(this.endpoint()));
  readonly manualDetails = computed(() => {
    const endpoint = validEndpoint(this.manualAddress());
    if (!endpoint) return null;
    const url = new URL(endpoint);
    return { host: url.hostname, port: url.port || (url.protocol === 'wss:' ? '443' : '80') };
  });
  private draftEndpoint = this.endpoint();
  readonly manualError = signal('');
  readonly fullscreenMessage = signal('');
  readonly fullscreen = signal(!!document.fullscreenElement);
  readonly settingsOpen = signal(false);
  readonly debugOpen = signal(false);
  readonly showConnection = computed(() => this.transport.status() !== 'connected');
  readonly throttlePercent = computed(() => Math.round(this.controller.state().throttle * 100));

  updateManualAddress(value: string, input: HTMLInputElement): void {
    this.draftEndpoint = editEndpoint(value, this.draftEndpoint);
    const visible = publicEndpoint(value);
    this.manualAddress.set(visible); input.value = visible;
    this.manualError.set('');
  }
  pasteManualAddress(event: ClipboardEvent, input: HTMLInputElement): void {
    const value = event.clipboardData?.getData('text'); if (!value) return;
    event.preventDefault(); this.updateManualAddress(value, input);
  }
  connectManual(): void {
    const parsed = validEndpoint(this.draftEndpoint);
    if (!parsed) { this.manualError.set('Introduce una dirección WebSocket válida.'); return; }
    this.endpoint.set(parsed); this.connect();
  }
  connect(): void {
    const address = validEndpoint(this.endpoint());
    if (!address) return;
    try { localStorage.setItem('fpv-controller-address', address); } catch { /* Storage may be disabled. */ }
    this.transport.connect(address);
    this.settingsOpen.set(false);
  }
  disconnect(): void { this.controller.resetButtons(); this.transport.disconnect(); }
  private readAddress(): string {
    try { const stored = localStorage.getItem('fpv-controller-address'); if (stored) return validEndpoint(stored) ?? ''; } catch { /* Use host fallback. */ }
    return validEndpoint(environment.defaultWebSocketEndpoint) ?? '';
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
