import { Component, inject } from '@angular/core';
import { PairingFlowService } from '../../core/services/pairing-flow.service';
import { PRODUCT_VERSION } from '../../../../../shared/src/product-version';
@Component({
  selector: 'app-connect-page',
  standalone: true,
  providers: [PairingFlowService],
  template: `
    <main aria-live="polite">
      <div class="glow" aria-hidden="true"></div>
      <section class="card">
        <div class="brand">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 4.9 3.1 7.4 8 8-4.9.6-7.4 3.1-8 8-.6-4.9-3.1-7.4-8-8 4.9-.6 7.4-3.1 8-8Z" /></svg>
          <span>FPV</span><small>v{{ version }}</small>
        </div>
        @if (flow.error()) {
          <span class="eyebrow error">NO SE PUDO CONECTAR</span>
          <h1>Unable to connect to PC</h1>
          @if (!flow.canRetry()) { <p>Este QR no es válido. Escanea el QR actual del companion.</p> }
          <p>Comprueba que el companion está abierto y ambos dispositivos están en la misma red. Permite el acceso a la red local si el navegador lo solicita.</p>
          @if (flow.canRetry()) { <button class="cta" (click)="flow.retry()">Retry</button> }
          <button class="secondary" (click)="flow.manual()">Manual connection</button>
        } @else {
          <span class="eyebrow">BUSCANDO TU PC</span>
          <div class="spinner" aria-hidden="true"></div>
          <h1>Connecting to PC...</h1>
        }
      </section>
    </main>`,
  styles: [`
    :host{display:block;min-height:100dvh;background:var(--fpv-bg);color:var(--fpv-ink);font-family:var(--fpv-font-ui)}
    main{position:relative;min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;overflow:hidden}
    .glow{position:absolute;left:-10%;right:-10%;bottom:-45%;height:90%;opacity:.2;pointer-events:none;
      background:radial-gradient(36% 56% at 18% 50%,var(--fpv-lava-pink),transparent 70%),radial-gradient(40% 62% at 50% 60%,var(--fpv-lava-violet),transparent 70%),radial-gradient(36% 56% at 84% 50%,var(--fpv-lava-blue),transparent 70%)}
    .card{position:relative;width:min(400px,100%);box-sizing:border-box;padding:24px;border-radius:28px;text-align:center;
      background:rgba(30,30,40,0.72);border:1px solid var(--fpv-edge);box-shadow:0 24px 60px rgba(0,0,0,0.45);
      -webkit-backdrop-filter:blur(var(--fpv-card-blur));backdrop-filter:blur(var(--fpv-card-blur))}
    .brand{display:flex;align-items:center;justify-content:center;gap:8px;font-size:18px;font-weight:700;margin-bottom:14px}
    .brand svg{width:22px;height:22px;fill:var(--fpv-ink)}.brand small{font-family:var(--fpv-font-mono);font-size:10px;font-weight:400;color:var(--fpv-muted)}
    .eyebrow{font-family:var(--fpv-font-mono);font-size:10px;letter-spacing:.1em;color:var(--fpv-warn)}.eyebrow.error{color:var(--fpv-error-text)}
    h1{font-size:22px;font-weight:700;margin:8px 0}p{color:var(--fpv-body);line-height:1.45;font-size:14px}
    button{display:flex;align-items:center;justify-content:center;width:100%;height:52px;margin-top:12px;border-radius:999px;font:700 16px var(--fpv-font-ui);cursor:pointer}
    .cta{border:0;background:var(--fpv-ink);color:var(--fpv-on-solid)}
    .secondary{height:44px;background:var(--fpv-chip);border:1px solid var(--fpv-chip-edge);color:var(--fpv-ink);font-weight:600;font-size:14px}
    button:focus-visible{outline:2px solid var(--fpv-ink);outline-offset:2px}
    .spinner{width:32px;height:32px;border:3px solid rgba(255,255,255,0.1);border-top-color:var(--fpv-accent);border-radius:50%;margin:20px auto 8px;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
    @media(prefers-reduced-transparency:reduce){.card{-webkit-backdrop-filter:none;backdrop-filter:none;background:#1B1B24}}
  `]
})
export class ConnectPageComponent { readonly flow = inject(PairingFlowService); readonly version = PRODUCT_VERSION; }
