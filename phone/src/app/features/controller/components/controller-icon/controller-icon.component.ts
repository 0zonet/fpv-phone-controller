import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Stroke icons from docs/design (24×24 viewBox). */
const paths = {
  settings: 'M4 7h10M18 7h2M18 7a2 2 0 1 1-4 0a2 2 0 1 1 4 0M4 17h2M10 17h10M10 17a2 2 0 1 1-4 0a2 2 0 1 1 4 0',
  live: 'M3 12h4l3-7 4 14 3-7h4',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  connect: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4',
  power: 'M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0',
  plus: 'M12 5v14M5 12h14',
  back: 'M19 12H5M11 18l-6-6 6-6',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8',
  spinner: 'M21 12a9 9 0 1 1-9-9',
  info: 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 11v5M12 8v.01',
  close: 'M6 6l12 12M18 6L6 18'
} as const;
export type ControllerIcon = keyof typeof paths;

@Component({
  selector: 'app-controller-icon', standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles: [':host { display: inline-flex; width: var(--icon-size, 18px); height: var(--icon-size, 18px); flex-shrink: 0; } svg { width: 100%; height: 100%; }']
})
export class ControllerIconComponent {
  readonly name = input.required<ControllerIcon>();
  readonly path = computed(() => paths[this.name()]);
}
