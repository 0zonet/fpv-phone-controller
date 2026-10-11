export type VirtualButtonMode = 'momentary' | 'toggle';
export interface ControllerButtonConfig { readonly index: number; readonly label: string; readonly mode: VirtualButtonMode; }
export const DEFAULT_CONTROLLER_BUTTONS: readonly ControllerButtonConfig[] = [
  { index: 0, label: 'ARM', mode: 'toggle' }, { index: 1, label: 'RESET', mode: 'momentary' },
  { index: 2, label: 'AUX 1', mode: 'toggle' }, { index: 3, label: 'AUX 2', mode: 'toggle' }
];
