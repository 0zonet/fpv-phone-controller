import type { MapperOptions } from './controller/virtual-controller.types.js';

export interface AppConfig {
  readonly websocketPort: number;
  readonly websocketHost: string;
  readonly maxPayload: number;
  readonly reportMs: number;
  readonly heartbeatMs: number;
  readonly shutdownMs: number;
  readonly maxPhoneClients: number;
  readonly controller: { readonly driver: 'vjoy'; readonly deviceId: number; readonly failsafeMs: number; readonly dllPath?: string };
  readonly calibration: NonNullable<MapperOptions['calibration']>;
  readonly debug: boolean;
}
export const defaultConfig: AppConfig = {
  websocketPort: 8080, websocketHost: '0.0.0.0', maxPayload: 2048,
  reportMs: 1000, heartbeatMs: 10000, shutdownMs: 2000, maxPhoneClients: 1,
  controller: { driver: 'vjoy', deviceId: 1, failsafeMs: 250 },
  debug: false,
  calibration: {
    throttle: { min: 0, max: 1, center: 0, invert: false, deadzone: 0 },
    yaw: { min: -1, max: 1, center: 0, invert: false, deadzone: .03 },
    pitch: { min: -1, max: 1, center: 0, invert: true, deadzone: .03 },
    roll: { min: -1, max: 1, center: 0, invert: false, deadzone: .03 }
  },
};
function integer(value: string | undefined, fallback: number, name: string, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < minimum || result > maximum) throw new Error(name + ' is out of range.');
  return result;
}
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    ...defaultConfig,
    debug: environment['CONTROLLER_DEBUG'] === '1',
    websocketPort: integer(environment['PORT'], defaultConfig.websocketPort, 'PORT', 1, 65535),
    controller: {
      ...defaultConfig.controller,
      deviceId: integer(environment['VJOY_DEVICE_ID'], defaultConfig.controller.deviceId, 'VJOY_DEVICE_ID', 1, 16),
      failsafeMs: integer(environment['FAILSAFE_MS'], defaultConfig.controller.failsafeMs, 'FAILSAFE_MS', 1, 60000),
      dllPath: environment['VJOY_DLL_PATH']
    }
  };
}
