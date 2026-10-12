import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';
import { cameraUnavailableReason, decodeWithJsQr, nativeQrDetector, type QrDetector } from '../../core/services/qr-decoder';
import { PairingService } from '../../core/services/pairing.service';
import { PairedEndpointService } from '../../core/services/paired-endpoint.service';
import { ControllerTransportService } from '../../core/services/controller-transport.service';
import { ControllerIconComponent } from '../controller/components/controller-icon/controller-icon.component';

type ScannerState = 'starting' | 'scanning' | 'insecure' | 'unsupported' | 'denied' | 'no-camera' | 'failed';
const SCAN_INTERVAL_MS = 180;

/**
 * In-app QR scanner (D7): getUserMedia + BarcodeDetector, with jsQR loaded on demand as fallback.
 * A valid pairing link is parsed by PairingService, saved and connected right away.
 */
@Component({
  selector: 'app-qr-scanner', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ControllerIconComponent],
  host: { '(document:keydown.escape)': 'close.emit()', '(document:visibilitychange)': 'visibilityChanged()' },
  template: `<div class="scanner" role="dialog" aria-modal="true" aria-label="Escanear QR">
    <video #video playsinline muted aria-hidden="true" [hidden]="state() !== 'scanning'"></video>
    <div class="frame" aria-hidden="true" [hidden]="state() !== 'scanning'"><span class="sweep"></span></div>
    <header>
      <button class="round" type="button" aria-label="Cerrar escáner" (click)="close.emit()"><app-controller-icon name="close" /></button>
      <span class="eyebrow">ESCANEAR QR</span>
    </header>
    <section class="panel" aria-live="polite">
      @switch (state()) {
        @case ('starting') { <p>Abriendo la cámara…</p> }
        @case ('scanning') { <p>Apunta al QR de la app de Windows.</p> @if (hint()) { <p class="hint">{{ hint() }}</p> } }
        @case ('insecure') {
          <h2>La cámara no está disponible aquí</h2>
          <p>El escáner solo funciona en la PWA publicada (https://). En la vista previa local http://IP:puerto el navegador bloquea la cámara.</p>
          <p class="hint">Escanea el QR con la app de cámara del teléfono o usa Conexión manual.</p>
        }
        @case ('unsupported') { <h2>Este navegador no permite usar la cámara</h2><p>Escanea el QR con la app de cámara del teléfono o usa Conexión manual.</p> }
        @case ('denied') { <h2>Permiso de cámara denegado</h2><p>Permite la cámara para este sitio en los ajustes del navegador, o escanea el QR con la app de cámara.</p> }
        @case ('no-camera') { <h2>No se encontró una cámara</h2><p>Escanea el QR con la app de cámara del teléfono o usa Conexión manual.</p> }
        @case ('failed') { <h2>No se pudo abrir la cámara</h2><p>Cierra otras apps que la usen e inténtalo de nuevo.</p> }
      }
      @if (state() !== 'starting' && state() !== 'scanning') {
        <div class="actions">
          @if (state() === 'denied' || state() === 'failed') { <button class="cta" type="button" (click)="start()">Reintentar</button> }
          <button class="secondary" type="button" (click)="manual.emit()">Conexión manual</button>
        </div>
      }
    </section>
  </div>`,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 20; display: block; }
    .scanner { position: relative; height: 100%; background: #000; color: var(--fpv-ink); font-family: var(--fpv-font-ui); overflow: hidden; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .frame { position: absolute; left: 50%; top: 50%; width: min(62vmin, 300px); aspect-ratio: 1; transform: translate(-50%, -50%);
      border-radius: 28px; box-shadow: 0 0 0 100vmax rgba(13, 13, 18, 0.55); border: 2px solid rgba(242, 242, 246, 0.85); overflow: hidden; }
    .sweep { position: absolute; left: 8px; right: 8px; top: 50%; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, var(--fpv-accent), transparent);
      box-shadow: 0 0 12px var(--fpv-accent); animation: sweep 2.8s ease-in-out infinite; }
    header { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px;
      padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left)); }
    .round { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--fpv-chip-edge); background: var(--fpv-pill-solid); color: var(--fpv-ink);
      display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .eyebrow { font-family: var(--fpv-font-mono); font-size: 10px; letter-spacing: .1em; color: var(--fpv-body); }
    .panel { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(440px, calc(100vw - 32px));
      box-sizing: border-box; padding: 14px 18px; border-radius: 22px; background: var(--fpv-pill-solid); border: 1px solid var(--fpv-edge); text-align: center; }
    .panel:has(h2) { top: 50%; bottom: auto; transform: translate(-50%, -50%); padding: 22px; background: #16161E; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
    p { margin: 0; font-size: 14px; line-height: 1.45; color: var(--fpv-body); }
    .hint { margin-top: 6px; font-size: 13px; color: var(--fpv-warn); }
    .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
    .cta { height: 48px; border: 0; border-radius: 999px; background: var(--fpv-ink); color: var(--fpv-on-solid); font: 700 15px var(--fpv-font-ui); cursor: pointer; }
    .secondary { height: 44px; border-radius: 999px; background: var(--fpv-chip); border: 1px solid var(--fpv-chip-edge); color: var(--fpv-ink); font: 600 14px var(--fpv-font-ui); cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--fpv-ink); outline-offset: 2px; }
    @keyframes sweep { 0% { top: 6%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 92%; opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .sweep { animation: none; } }
  `]
})
export class QrScannerComponent implements OnInit, OnDestroy {
  readonly close = output<void>();
  readonly manual = output<void>();
  readonly paired = output<void>();
  readonly state = signal<ScannerState>('starting');
  readonly hint = signal('');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly parser = inject(PairingService);
  private readonly endpoints = inject(PairedEndpointService);
  private readonly transport = inject(ControllerTransportService);
  private stream: MediaStream | null = null;
  private detector: QrDetector | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private canvas: HTMLCanvasElement | null = null;
  private busy = false;
  private stopped = false;
  private lastInvalid = '';

  ngOnInit(): void { void this.start(); }
  ngOnDestroy(): void { this.stopped = true; this.stop(); }
  visibilityChanged(): void { if (document.hidden) this.stop(); else if (!this.stopped && !this.stream && this.state() === 'scanning') void this.start(); }

  async start(): Promise<void> {
    const reason = cameraUnavailableReason({ isSecureContext: window.isSecureContext, navigator });
    if (reason) { this.state.set(reason as ScannerState); return; }
    this.state.set('starting'); this.hint.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (this.stopped) { this.stop(); return; }
      const video = this.video().nativeElement;
      video.srcObject = this.stream; await video.play();
      this.detector = await nativeQrDetector();
      this.state.set('scanning');
      this.schedule();
    } catch (error) {
      this.stop();
      const name = (error as { name?: string })?.name;
      this.state.set(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no-camera' : 'failed');
    }
  }
  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.scan(), SCAN_INTERVAL_MS);
  }
  private async scan(): Promise<void> {
    if (this.stopped || !this.stream || this.busy) return;
    const video = this.video().nativeElement;
    if (video.readyState < 2 || !video.videoWidth) { this.schedule(); return; }
    this.busy = true;
    try {
      const text = this.detector ? (await this.detector.detect(video))[0]?.rawValue ?? null : await this.decodeFrame(video);
      if (text && this.accept(text)) return;
    } catch { /* A failed frame is retried on the next tick. */ }
    finally { this.busy = false; }
    this.schedule();
  }
  private async decodeFrame(video: HTMLVideoElement): Promise<string | null> {
    // Downscale: jsQR on a full 1280 px frame is slow on mid-range phones.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale), height = Math.round(video.videoHeight * scale);
    this.canvas ??= document.createElement('canvas');
    this.canvas.width = width; this.canvas.height = height;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return decodeWithJsQr({ data: image.data, width, height });
  }
  /** True when the QR was a valid pairing link (the scanner then closes). */
  private accept(text: string): boolean {
    let endpoint: string;
    try { endpoint = this.parser.parsePairingUrl(text); }
    catch {
      if (text !== this.lastInvalid) { this.lastInvalid = text; this.hint.set('Este QR no es de FPV Phone Controller. Escanea el de la app de Windows.'); }
      return false;
    }
    const saved = this.endpoints.save(endpoint);
    if (!saved) return false;
    this.stopped = true; this.stop();
    this.transport.connect(saved);
    this.paired.emit();
    return true;
  }
  private stop(): void {
    clearTimeout(this.timer); this.timer = undefined;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    try { const video = this.video().nativeElement; video.pause(); video.srcObject = null; } catch { /* Not rendered yet. */ }
  }
}
