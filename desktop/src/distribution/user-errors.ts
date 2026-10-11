export interface UserIssue { readonly code: string; readonly message: string; }
export function userIssue(error: unknown): UserIssue {
  const text = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'EADDRINUSE') return { code: 'PORT_BUSY', message: 'Port already in use. Close another companion or app using this port, then Retry.' };
  if (code === 'EACCES' || code === 'EPERM') return { code: 'NETWORK_PERMISSION', message: 'Windows denied network access. Check app permissions and private-network firewall rules, then Retry.' };
  if (/not free|acquire vJoy/i.test(text)) return { code: 'DEVICE_BUSY', message: 'Virtual joystick is occupied. Close other joystick feeders, then Retry.' };
  if (/axis.*missing|device.*missing/i.test(text)) return { code: 'DEVICE_UNAVAILABLE', message: 'Virtual joystick is not configured. Enable device 1 with X, Y, Z and Slider in Configure vJoy, then Retry.' };
  if (/versions do not match/i.test(text)) return { code: 'DRIVER_MISMATCH', message: 'vJoy driver and interface versions differ. Reinstall the matching x64 vJoy release, then Retry.' };
  if (/not found|not installed|cannot load|disabled|VJOY_DLL_PATH/i.test(text)) return { code: 'DRIVER_MISSING', message: 'Virtual joystick driver not installed or unavailable. Install the supported x64 vJoy driver, then Retry.' };
  return { code: 'STARTUP_FAILED', message: 'The companion could not start. Retry; if it persists, open the logs folder and share the logs.' };
}
export const connectionHelp = 'Still waiting for your phone. Check the shared network, allow local-network access in Chrome and review Windows private-network firewall permissions. The firewall may be blocking the connection.';
