import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { PRODUCT_VERSION } from '../../../../../shared/src/product-version';
import { AXIS_NAMES, applyStickSettings, MAX_BUTTON_LABEL, MAX_DEADZONE, type AxisName } from '../../core/models/settings.model';
import type { VirtualButtonMode } from '../../core/models/controller-button.model';
import { SettingsService } from '../../core/services/settings.service';
import { ControllerStateService } from '../../core/services/controller-state.service';
import { ControllerTransportService } from '../../core/services/controller-transport.service';
import { PwaRuntimeService } from '../../core/services/pwa-runtime.service';
import { PairedEndpointService } from '../../core/services/paired-endpoint.service';
import { editEndpoint, publicEndpoint, validEndpoint } from '../../core/services/connection-address';
import { ControllerIconComponent } from '../controller/components/controller-icon/controller-icon.component';
import { ConnectionStatusComponent } from '../controller/components/connection-status/connection-status.component';
import { formatAxis } from '../controller/utils/axis-format';
import { VirtualStickComponent } from '../controller/components/virtual-stick/virtual-stick.component';

export type SettingsSection = 'sticks' | 'buttons' | 'connection' | 'advanced';

/**
 * Full-screen settings (docs/design/PhoneSettings.dc.html). It is an overlay of the flight screen,
 * not a route, so opening it never drops the connection.
 */
@Component({
  selector: 'app-settings-panel', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ControllerIconComponent, ConnectionStatusComponent, VirtualStickComponent],
  templateUrl: './settings-panel.component.html', styleUrl: './settings-panel.component.css',
  host: { '(document:keydown.escape)': 'close.emit()' }
})
export class SettingsPanelComponent implements OnInit {
  readonly initial = input<SettingsSection>('sticks');
  readonly close = output<void>();
  /** Opens the in-app QR scanner (handled by the flight screen). */
  readonly scan = output<void>();
  readonly service = inject(SettingsService);
  readonly controller = inject(ControllerStateService);
  readonly transport = inject(ControllerTransportService);
  readonly pwa = inject(PwaRuntimeService);
  private readonly paired = inject(PairedEndpointService);
  readonly version = PRODUCT_VERSION;
  readonly axes = AXIS_NAMES;
  readonly axisLabels: Record<AxisName, string> = { yaw: 'YAW', throttle: 'THR', roll: 'ROLL', pitch: 'PITCH' };
  readonly maxDeadzone = MAX_DEADZONE * 100;
  readonly maxLabel = MAX_BUTTON_LABEL;
  readonly section = signal<SettingsSection>('sticks');
  readonly sections: readonly { id: SettingsSection; name: string }[] = [
    { id: 'sticks', name: 'Sticks' }, { id: 'buttons', name: 'Botones' }, { id: 'connection', name: 'Conexión' }, { id: 'advanced', name: 'Avanzado' }];
  readonly settings = this.service.settings;
  readonly deadzonePercent = computed(() => Math.round(this.settings().deadzone * 100));
  readonly testing = signal(false);
  /** What the PC receives right now (before its own calibration). */
  readonly sent = computed(() => {
    const state = applyStickSettings(this.controller.state(), this.settings());
    const centred = (name: string, value: number) => ({ name, value: formatAxis(value), centred: true,
      left: 50 + Math.min(0, value) * 50, width: Math.abs(value) * 50 });
    return [
      { name: 'THR', value: Math.round(state.throttle * 100) + ' %', centred: false, left: 0, width: state.throttle * 100 },
      centred('YAW', state.yaw), centred('PITCH', state.pitch), centred('ROLL', state.roll)
    ];
  });

  // Manual connection (moved from the flight screen).
  readonly endpointPreview = computed(() => publicEndpoint(this.paired.endpoint()));
  readonly manualAddress = signal(publicEndpoint(this.paired.endpoint()));
  private draftEndpoint = this.paired.endpoint();
  readonly manualError = signal('');
  readonly manualDetails = computed(() => {
    const endpoint = validEndpoint(this.manualAddress());
    if (!endpoint) return null;
    const url = new URL(endpoint);
    return { host: url.hostname, port: url.port || (url.protocol === 'wss:' ? '443' : '80') };
  });

  ngOnInit(): void { this.section.set(this.initial()); }
  deadzoneInput(value: string): void { this.service.setDeadzone(Number(value) / 100); }
  labelInput(index: number, value: string): void { this.service.setButtonLabel(index, value); }
  setMode(index: number, mode: VirtualButtonMode): void {
    if (this.settings().buttons[index]?.mode === mode) return;
    this.controller.setButton(index, false); this.service.setButtonMode(index, mode);
  }
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
    const endpoint = this.paired.save(this.draftEndpoint);
    if (!endpoint) { this.manualError.set('Introduce una dirección WebSocket válida.'); return; }
    this.transport.connect(endpoint);
    this.close.emit();
  }
  disconnect(): void { this.controller.resetButtons(); this.transport.disconnect(); }
  resetAll(): void { this.service.reset(); }
}
