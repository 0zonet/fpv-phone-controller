import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { StickValue } from '../../../../core/models/stick-state.model';
import { limitToCircle, pointerToValue, releaseValue, valueToVisual } from '../../utils/stick-math';

@Component({
  selector: 'app-virtual-stick', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './virtual-stick.component.html', styleUrl: './virtual-stick.component.css',
  host: {
    '(window:blur)': 'release()',
    '(document:visibilitychange)': 'onVisibilityChange()'
  }
})
export class VirtualStickComponent {
  readonly xValue = input(0);
  readonly yValue = input(0);
  readonly xReturnToCenter = input(true);
  readonly yReturnToCenter = input(true);
  readonly invertY = input(true);
  readonly label = input('Stick virtual');
  readonly valueChange = output<StickValue>();
  readonly value = computed(() => limitToCircle({ x: this.xValue(), y: this.yValue() }));
  readonly visual = computed(() => valueToVisual(this.value(), this.invertY()));
  readonly active = computed(() => this.pointerId() !== null);
  private readonly pointerId = signal<number | null>(null);
  private target: HTMLElement | null = null;
  private lastValue: StickValue | null = null;

  onPointerDown(event: PointerEvent, surface: HTMLElement): void {
    if (this.active() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    this.target = surface;
    this.pointerId.set(event.pointerId);
    this.lastValue = this.value();
    surface.setPointerCapture(event.pointerId);
    this.onPointerMove(event);
  }
  onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId() || !this.target) return;
    event.preventDefault();
    const bounds = this.target.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.emit(pointerToValue(event.clientX, event.clientY, bounds, this.invertY()));
  }
  onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId()) return;
    this.onPointerMove(event);
    this.release();
  }
  onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.pointerId()) this.release();
  }
  onVisibilityChange(): void { if (document.hidden) this.release(); }
  release(): void {
    if (!this.active()) return;
    const pointerId = this.pointerId();
    const target = this.target;
    const value = this.lastValue ?? this.value();
    this.pointerId.set(null);
    this.target = null;
    this.lastValue = null;
    if (pointerId !== null && target?.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    this.valueChange.emit(releaseValue(value, { x: this.xReturnToCenter(), y: this.yReturnToCenter() }));
  }
  onKeyDown(event: KeyboardEvent): void {
    if (this.active()) return;
    const steps: Record<string, StickValue> = {
      ArrowLeft: { x: -0.05, y: 0 }, ArrowRight: { x: 0.05, y: 0 },
      ArrowUp: { x: 0, y: this.invertY() ? 0.05 : -0.05 },
      ArrowDown: { x: 0, y: this.invertY() ? -0.05 : 0.05 }
    };
    const step = steps[event.key];
    if (!step && event.key !== 'Escape') return;
    event.preventDefault();
    const value = this.value();
    this.valueChange.emit(step
      ? limitToCircle({ x: value.x + step.x, y: value.y + step.y })
      : releaseValue(value, { x: this.xReturnToCenter(), y: this.yReturnToCenter() }));
  }
  onKeyUp(event: KeyboardEvent): void {
    if (event.key.startsWith('Arrow') && !this.active()) {
      this.valueChange.emit(releaseValue(this.value(), { x: this.xReturnToCenter(), y: this.yReturnToCenter() }));
    }
  }
  private emit(value: StickValue): void { this.lastValue = value; this.valueChange.emit(value); }
}
