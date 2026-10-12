import type { VirtualButtonMode } from '../../../core/models/controller-button.model';
/** A toggle only flips on a tap: a touch that travels further (a scroll or a slide) leaves it as it was. */
export const TOGGLE_TAP_SLOP_PX = 16;
export interface PointerPosition { readonly x: number; readonly y: number; }
/** Caption under the label: momentary shows its mode (HOLD); toggle shows its real state. */
export function buttonCaption(mode: VirtualButtonMode, pressed: boolean): string {
  return mode === 'momentary' ? 'HOLD' : pressed ? 'ON' : 'OFF';
}
/** Each instance owns one pointer; other touches cannot release it. */
export class ButtonInteraction {
  private pointer: number | undefined;
  private mode: VirtualButtonMode = 'momentary';
  private start: PointerPosition | undefined;
  constructor(private readonly emit: (pressed: boolean) => void) {}
  press(pointer: number, mode: VirtualButtonMode, disabled: boolean, at?: PointerPosition): void {
    if (disabled || this.pointer !== undefined) return;
    this.pointer = pointer; this.mode = mode; this.start = at;
    if (mode === 'momentary') this.emit(true);
  }
  release(pointer: number, current: boolean, inside = true, at?: PointerPosition): void {
    if (pointer !== this.pointer) return;
    this.pointer = undefined;
    const start = this.start; this.start = undefined;
    const moved = !!start && !!at && Math.hypot(at.x - start.x, at.y - start.y) > TOGGLE_TAP_SLOP_PX;
    if (this.mode === 'momentary') this.emit(false);
    else if (inside && !moved) this.emit(!current);
  }
  cancel(pointer?: number): void {
    if (this.pointer === undefined || (pointer !== undefined && this.pointer !== pointer)) return;
    this.pointer = undefined; this.start = undefined;
    if (this.mode === 'momentary') this.emit(false);
  }
}
