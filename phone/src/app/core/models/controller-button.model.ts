export type VirtualButtonMode = 'momentary' | 'toggle';
export interface ControllerButtonConfig { readonly index: number; readonly label: string; readonly mode: VirtualButtonMode; }
/** Initial labels and modes; the user edits them in Ajustes → Botones (stored in fpv-settings-v1). */
export const DEFAULT_CONTROLLER_BUTTONS: readonly ControllerButtonConfig[] = Object.freeze([
  { index: 0, label: 'ARM', mode: 'toggle' }, { index: 1, label: 'RESET', mode: 'momentary' },
  { index: 2, label: 'AUX 1', mode: 'toggle' }, { index: 3, label: 'AUX 2', mode: 'toggle' },
  { index: 4, label: 'AUX 3', mode: 'toggle' }, { index: 5, label: 'AUX 4', mode: 'toggle' },
  { index: 6, label: 'BTN 7', mode: 'momentary' }, { index: 7, label: 'BTN 8', mode: 'momentary' }
] as ControllerButtonConfig[]);
