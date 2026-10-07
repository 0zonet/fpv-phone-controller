import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const paths = {
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  debug: 'M4 19V5M4 19h16M7 14l4-5 4 3 5-7',
  expand: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',
  collapse: 'M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5',
  connect: 'M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8M12 16v5',
  close: 'M6 6l12 12M18 6L6 18'
} as const;
export type ControllerIcon = keyof typeof paths;

@Component({
  selector: 'app-controller-icon', standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles: [':host { display: inline-flex; width: 22px; height: 22px; flex-shrink: 0; } svg { width: 100%; height: 100%; }']
})
export class ControllerIconComponent {
  readonly name = input.required<ControllerIcon>();
  readonly path = computed(() => paths[this.name()]);
}
