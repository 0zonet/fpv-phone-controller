import { ChangeDetectionStrategy, Component, computed, effect, input, OnDestroy, output } from '@angular/core';
import type { VirtualButtonMode } from '../../../../core/models/controller-button.model';
import { ButtonInteraction } from '../../utils/button-interaction';
@Component({
  selector: 'app-virtual-button', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:blur)': 'cancel()', '(document:visibilitychange)': 'visibilityChanged()' },
  template: `<button type="button" [disabled]="disabled()" [class.active]="pressed()" [class.arm]="kind() === 'arm'"
    [attr.aria-pressed]="mode() === 'toggle' ? pressed() : null" [attr.aria-label]="label()"
    (pointerdown)="down($event)" (pointerup)="up($event)" (pointercancel)="cancel($event.pointerId)"
    (lostpointercapture)="cancel($event.pointerId)" (click)="activate($event)">
    <span class="name">{{ kind() === 'arm' && pressed() ? 'ARMED' : label() }}</span>
    <small>{{ caption() }}</small>
  </button>`,
  styles: [`:host { display:block; min-width:0; }
    button { width:100%; height:var(--button-height, 60px); padding:0 6px; border-radius:20px; border:1px solid var(--fpv-chip-edge);
      background:rgba(255,255,255,0.05); color:var(--fpv-ink); font-family:var(--fpv-font-mono); cursor:pointer;
      touch-action:none; user-select:none; -webkit-user-select:none;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; }
    .name { font-size:13px; font-weight:500; letter-spacing:.08em; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    small { font-size:9px; letter-spacing:.06em; color:var(--fpv-muted); }
    button.active { background:rgba(139,124,255,0.2); border-color:rgba(139,124,255,0.7); }
    button.active:not([aria-pressed]) { background:rgba(255,255,255,0.16); border-color:var(--fpv-chip-edge); }
    button.arm small { color:inherit; opacity:.75; }
    button.arm.active { background:rgba(248,113,113,0.18); border-color:var(--fpv-error); color:var(--fpv-error-text); }
    button:disabled { opacity:.45; cursor:default; }
    button:focus-visible { outline:2px solid var(--fpv-ink); outline-offset:2px; }
    @media (prefers-reduced-motion: no-preference) {
      button { transition:background-color .15s ease, border-color .15s ease, transform .1s ease; }
      button:active:not(:disabled) { transform:scale(.97); }
    }`]
})
export class VirtualButtonComponent implements OnDestroy {
  readonly label = input('Button'); readonly mode = input<VirtualButtonMode>('momentary');
  readonly pressed = input(false); readonly disabled = input(false);
  /** 'arm' shows ARMED in red while on. */
  readonly kind = input<'arm' | 'default'>('default');
  readonly caption = computed(() => this.mode() === 'momentary' ? 'HOLD' : this.kind() === 'arm' ? 'TOGGLE' : this.pressed() ? 'ON' : 'OFF');
  readonly pressedChange = output<boolean>();
  private readonly interaction = new ButtonInteraction(value => this.pressedChange.emit(value));
  constructor() { effect(() => { if (this.disabled()) this.cancel(); }); }
  down(event: PointerEvent): void {
    if (event.button !== 0 || this.disabled()) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLButtonElement;
    this.interaction.press(event.pointerId, this.mode(), false);
    target.setPointerCapture(event.pointerId);
  }
  up(event: PointerEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLButtonElement;
    const rect = target.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (this.disabled()) this.cancel(event.pointerId);
    else this.interaction.release(event.pointerId, this.pressed(), inside);
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  }
  cancel(pointer?: number): void { this.interaction.cancel(pointer); }
  visibilityChanged(): void { if (document.hidden) this.cancel(); }
  activate(event: MouseEvent): void {
    // Native keyboard / assistive activation; pointer gestures are handled above.
    if (event.detail !== 0 || this.disabled()) return;
    if (this.mode() === 'toggle') this.pressedChange.emit(!this.pressed());
    else { this.pressedChange.emit(true); this.pressedChange.emit(false); }
  }
  ngOnDestroy(): void { this.cancel(); }
}
