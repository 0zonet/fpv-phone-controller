import type { VirtualButtonMode } from '../../../core/models/controller-button.model';
/** Each instance owns one pointer; other touches cannot release it. */
export class ButtonInteraction {
  private pointer: number | undefined;
  private mode: VirtualButtonMode = 'momentary';
  constructor(private readonly emit: (pressed: boolean) => void) {}
  press(pointer: number, mode: VirtualButtonMode, disabled: boolean): void {
    if (disabled || this.pointer !== undefined) return;
    this.pointer = pointer; this.mode = mode;
    if (mode === 'momentary') this.emit(true);
  }
  release(pointer: number, current: boolean, inside = true): void {
    if (pointer !== this.pointer) return;
    this.pointer = undefined;
    if (this.mode === 'momentary') this.emit(false);
    else if (inside) this.emit(!current);
  }
  cancel(pointer?: number): void {
    if (this.pointer === undefined || (pointer !== undefined && this.pointer !== pointer)) return;
    this.pointer = undefined;
    if (this.mode === 'momentary') this.emit(false);
  }
}
