import { VirtualButtonComponent } from '../../components/virtual-button/virtual-button.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { ControllerIconComponent } from '../../components/controller-icon/controller-icon.component';
import { ControllerStateService } from '../../../../core/services/controller-state.service';
import { ControllerTransportService } from '../../../../core/services/controller-transport.service';
import { ControllerTransmissionService } from '../../../../core/services/controller-transmission.service';
import { VirtualStickComponent } from '../../components/virtual-stick/virtual-stick.component';
import { ConnectionStatusComponent, pillState } from '../../components/connection-status/connection-status.component';
import { browserWakeLockHost, ScreenWakeLock } from '../../../../core/services/screen-wake-lock';
import { formatAxis } from '../../utils/axis-format';
import { SettingsService } from '../../../../core/services/settings.service';
import { PairedEndpointService } from '../../../../core/services/paired-endpoint.service';
import { applyStickSettings } from '../../../../core/models/settings.model';
import { SettingsPanelComponent, type SettingsSection } from '../../../settings/settings-panel.component';
import { QrScannerComponent } from '../../../scanner/qr-scanner.component';

@Component({
  selector: 'app-controller-page', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ControllerTransmissionService],
  imports: [VirtualButtonComponent, VirtualStickComponent, ConnectionStatusComponent, ControllerIconComponent, SettingsPanelComponent, QrScannerComponent],
  host: { '(document:fullscreenchange)': 'syncFullscreen()', '(window:blur)': 'controller.resetButtons()', '(document:visibilitychange)': 'visibilityChanged()' },
  templateUrl: './controller-page.component.html', styleUrl: './controller-page.component.css'
})
export class ControllerPageComponent implements OnDestroy {
  visibilityChanged(): void { if (document.hidden) this.controller.resetButtons(); this.wakeLock.visibilityChanged(); }
  readonly controller = inject(ControllerStateService);
  readonly transport = inject(ControllerTransportService);
  private readonly transmission = inject(ControllerTransmissionService);
  readonly settingsService = inject(SettingsService);
  readonly settings = this.settingsService.settings;
  private readonly paired = inject(PairedEndpointService);
  readonly hasPc = computed(() => !!this.paired.endpoint());
  readonly mainButtons = computed(() => this.settings().buttons.slice(0, 4));
  readonly extraButtons = computed(() => this.settings().buttons.slice(4));
  readonly extraActive = computed(() => this.controller.buttons().slice(4).filter(Boolean).length);
  readonly moreOpen = signal(false);
  readonly scannerOpen = signal(false);
  readonly fullscreenMessage = signal('');
  readonly fullscreen = signal(!!document.fullscreenElement);
  readonly settingsOpen = signal(false);
  readonly settingsSection = signal<SettingsSection>('sticks');
  readonly liveValues = computed(() => this.settings().liveValues);
  readonly connected = computed(() => this.transport.status() === 'connected');
  /** Readouts show what is sent to the PC (phone deadzone and inversion applied). */
  private readonly sent = computed(() => applyStickSettings(this.controller.state(), this.settings()));
  readonly yawText = computed(() => formatAxis(this.sent().yaw));
  readonly rollText = computed(() => formatAxis(this.sent().roll));
  readonly pitchText = computed(() => formatAxis(this.sent().pitch));
  /** Connection card copy for every state except connected (docs/design/PhoneIdle.dc.html). */
  readonly card = computed(() => {
    const state = pillState(this.transport.status(), this.transport.connectionLost());
    if (this.transport.reconnecting()) return { tone: 'connecting', eyebrow: 'SIN RESPUESTA DEL PC', title: 'Reconectando…', body: 'Se perdió la conexión. Reintentando durante unos 30 s; los botones quedan en OFF.', cta: 'Cancelar' };
    if (this.transport.endReason() === 'rejected') return { tone: 'error', eyebrow: 'QR ANTIGUO', title: 'Este QR ya no es válido', body: 'La app de Windows se reinició o generó un QR nuevo. Escanea el QR actual.', cta: 'Escanear QR' };
    if (this.transport.endReason() === 'pc') return { tone: 'idle', eyebrow: 'DESCONECTADO DESDE EL PC', title: 'El PC cerró la sesión', body: 'Puedes volver a conectar cuando quieras.', cta: 'Conectar' };
    if (state === 'connecting') return { tone: 'connecting', eyebrow: 'BUSCANDO TU PC', title: 'Conectando…', body: 'Mantén el teléfono y el PC en la misma red Wi‑Fi.', cta: 'Cancelar' };
    if (state === 'lost') return { tone: 'error', eyebrow: 'SIN RESPUESTA DEL PC', title: 'Se perdió la conexión', body: 'Revisa que la app de Windows siga abierta y que el firewall permita la red local.', cta: 'Reintentar' };
    if (state === 'failed') return { tone: 'error', eyebrow: 'NO SE PUDO CONECTAR', title: 'No se pudo conectar', body: 'Comprueba la red y la app de Windows. Si la reiniciaste, escanea su nuevo QR.', cta: 'Reintentar' };
    if (!this.hasPc()) return { tone: 'idle', eyebrow: 'SIN PC EMPAREJADO', title: 'Empareja tu PC', body: 'Abre FPV Phone Controller en Windows y escanea su QR.', cta: 'Escanear QR' };
    return { tone: 'idle', eyebrow: 'PC · VÍA QR', title: 'Listo para emparejar', body: 'Abre FPV Phone Controller en Windows. Si llegaste desde el QR, solo toca Conectar.', cta: 'Conectar' };
  });
  private readonly wakeLock = new ScreenWakeLock(browserWakeLockHost());
  constructor() {
    // Keep the screen on only while flying.
    effect(() => this.wakeLock.set(this.connected()));
  }
  ngOnDestroy(): void { this.wakeLock.set(false); }
  readonly throttle = computed(() => this.sent().throttle);
  readonly throttlePercent = computed(() => Math.round(this.throttle() * 100));

  openSettings(section: SettingsSection = 'sticks'): void { this.settingsSection.set(section); this.moreOpen.set(false); this.settingsOpen.set(true); }
  connect(): void {
    const address = this.paired.endpoint();
    if (!address) return;
    this.transport.connect(address);
  }
  disconnect(): void { this.controller.resetButtons(); this.transport.disconnect(); }

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
