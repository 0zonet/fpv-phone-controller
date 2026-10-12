import { VirtualButtonComponent } from '../../components/virtual-button/virtual-button.component';
import { DEFAULT_CONTROLLER_BUTTONS } from '../../../../core/models/controller-button.model';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { ControllerIconComponent } from '../../components/controller-icon/controller-icon.component';
import { environment } from '../../../../../environments/environment';
import { ControllerStateService } from '../../../../core/services/controller-state.service';
import { ControllerTransportService } from '../../../../core/services/controller-transport.service';
import { ControllerTransmissionService } from '../../../../core/services/controller-transmission.service';
import { VirtualStickComponent } from '../../components/virtual-stick/virtual-stick.component';
import { ConnectionStatusComponent } from '../../components/connection-status/connection-status.component';
import { PRODUCT_VERSION } from '../../../../../../../shared/src/product-version';
import { validEndpoint, publicEndpoint, editEndpoint } from '../../../../core/services/connection-address';
import { PwaRuntimeService } from '../../../../core/services/pwa-runtime.service';
import { browserWakeLockHost, ScreenWakeLock } from '../../../../core/services/screen-wake-lock';
import { formatAxis } from '../../utils/axis-format';
import { pillState } from '../../components/connection-status/connection-status.component';

@Component({
  selector: 'app-controller-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ControllerTransmissionService],
  imports: [VirtualButtonComponent, VirtualStickComponent, ConnectionStatusComponent, ControllerIconComponent],
  host: { '(document:fullscreenchange)': 'syncFullscreen()', '(window:blur)': 'controller.resetButtons()', '(document:visibilitychange)': 'visibilityChanged()' },
  templateUrl: './controller-page.component.html', styleUrl: './controller-page.component.css'
})
export class ControllerPageComponent implements OnDestroy {
  readonly buttonConfigs = DEFAULT_CONTROLLER_BUTTONS;
  visibilityChanged(): void { if (document.hidden) this.controller.resetButtons(); this.wakeLock.visibilityChanged(); }
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
  readonly liveValues = signal(true);
  readonly connected = computed(() => this.transport.status() === 'connected');
  readonly yawText = computed(() => formatAxis(this.controller.yaw()));
  readonly rollText = computed(() => formatAxis(this.controller.roll()));
  readonly pitchText = computed(() => formatAxis(this.controller.pitch()));
  /** Connection card copy for every state except connected (docs/design/PhoneIdle.dc.html). */
  readonly card = computed(() => {
    const state = pillState(this.transport.status(), this.transport.connectionLost());
    if (state === 'connecting') return { tone: 'connecting', eyebrow: 'BUSCANDO TU PC', title: 'Conectando…', body: 'Mantén el teléfono y el PC en la misma red Wi‑Fi.', cta: 'Cancelar' };
    if (state === 'lost') return { tone: 'error', eyebrow: 'SIN RESPUESTA DEL PC', title: 'Se perdió la conexión', body: 'Revisa que la app de Windows siga abierta y que el firewall permita la red local.', cta: 'Reintentar' };
    if (state === 'failed') return { tone: 'error', eyebrow: 'NO SE PUDO CONECTAR', title: 'No se pudo conectar', body: 'Comprueba la red y la app de Windows. Si la reiniciaste, escanea su nuevo QR.', cta: 'Reintentar' };
    if (!this.paired()) return { tone: 'idle', eyebrow: 'SIN PC EMPAREJADO', title: 'Empareja tu PC', body: 'Abre FPV Phone Controller en Windows y escanea su QR con la cámara del teléfono.', cta: 'Conexión manual' };
    return { tone: 'idle', eyebrow: 'PC · VÍA QR', title: 'Listo para emparejar', body: 'Abre FPV Phone Controller en Windows. Si llegaste desde el QR, solo toca Conectar.', cta: 'Conectar' };
  });
  private readonly wakeLock = new ScreenWakeLock(browserWakeLockHost());
  constructor() {
    // Keep the screen on only while flying.
    effect(() => this.wakeLock.set(this.connected()));
  }
  ngOnDestroy(): void { this.wakeLock.set(false); }
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
