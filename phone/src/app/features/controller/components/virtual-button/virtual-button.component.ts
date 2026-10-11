import { ChangeDetectionStrategy, Component, effect, input, OnDestroy, output } from '@angular/core';
import type { VirtualButtonMode } from '../../../../core/models/controller-button.model';
import { ButtonInteraction } from '../../utils/button-interaction';
@Component({
  selector: 'app-virtual-button', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:blur)': 'cancel()', '(document:visibilitychange)': 'visibilityChanged()' },
  template: `<button type="button" [disabled]="disabled()" [class.active]="pressed()"
    [attr.aria-pressed]="mode() === 'toggle' ? pressed() : null" [attr.aria-label]="label()"
    (pointerdown)="down($event)" (pointerup)="up($event)" (pointercancel)="cancel($event.pointerId)"
    (lostpointercapture)="cancel($event.pointerId)" (click)="activate($event)">
    <span>{{ label() }}</span>
    @if (mode() === 'toggle') { <small>{{ pressed() ? '● ON' : '○ OFF' }}</small> }
  </button>`,
  styles: [`:host { display:block; min-width:0; } button { width:100%; min-height:48px; padding:7px 16px;
    border:1px solid #345168; border-radius:12px; background:#102130; color:#b7c8d6; font:inherit;
    font-size:13px; font-weight:650; touch-action:none; user-select:none; -webkit-user-select:none;
    display:flex; align-items:center; justify-content:center; gap:10px; }
    small { font-size:10px; } button.active { background:#154a3b; border-color:#4ce3b2; color:#4ce3b2; }
    button:disabled { opacity:.45; } button:focus-visible { outline:2px solid #4ce3b2; outline-offset:3px; }`]
})
export class VirtualButtonComponent implements OnDestroy {
  readonly label = input('Button'); readonly mode = input<VirtualButtonMode>('momentary');
  readonly pressed = input(false); readonly disabled = input(false);
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
