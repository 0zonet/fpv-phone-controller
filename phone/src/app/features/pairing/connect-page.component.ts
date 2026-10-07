import { Component, inject } from '@angular/core';
import { PairingFlowService } from '../../core/services/pairing-flow.service';
@Component({
  selector: 'app-connect-page',
  standalone: true,
  providers: [PairingFlowService],
  template: `
    <main aria-live="polite">
      <section>
        <span class="brand">FPV</span>
        @if (flow.error()) {
          <h1>Unable to connect to PC</h1>
          <p>Comprueba que el companion está abierto y ambos dispositivos están en la misma red. Permite el acceso a la red local si el navegador lo solicita.</p>
          @if (flow.canRetry()) { <button (click)="flow.retry()">Retry</button> }
          <button class="secondary" (click)="flow.manual()">Enter address manually</button>
        } @else {
          <div class="spinner" aria-hidden="true"></div>
          <h1>Connecting to PC...</h1>
        }
      </section>
    </main>`,
  styles: [`
    :host{display:block;min-height:100dvh;background:#08121c;color:#e9f1f7;font-family:system-ui}
    main{min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
    section{max-width:440px;text-align:center}.brand{color:#43dfb2;font-size:32px;font-weight:800}
    h1{font-size:24px}p{color:#a5b7c5;line-height:1.6}
    button{display:block;width:100%;padding:14px;margin-top:12px;border:0;border-radius:14px;background:#43dfb2;color:#08121c;font:600 16px system-ui}
    button.secondary{background:#172938;color:#e9f1f7}
    .spinner{width:32px;height:32px;border:3px solid #203746;border-top-color:#43dfb2;border-radius:50%;margin:24px auto;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
  `]
})
export class ConnectPageComponent { readonly flow = inject(PairingFlowService); }
