export interface UserIssue { readonly code: string; readonly message: string; }
export function userIssue(error: unknown): UserIssue {
  const text = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'EADDRINUSE') return { code: 'PORT_BUSY', message: 'Port already in use. Close another companion or app using this port, then Retry.' };
  if (code === 'EACCES' || code === 'EPERM') return { code: 'NETWORK_PERMISSION', message: 'Windows denied network access. Check app permissions and private-network firewall rules, then Retry.' };
  if (/not free|acquire vJoy/i.test(text)) return { code: 'DEVICE_BUSY', message: 'Virtual joystick is occupied. Close other joystick feeders, then Retry.' };
  if (/axis.*missing|device.*missing|buttons.*missing/i.test(text)) return { code: 'DEVICE_UNAVAILABLE', message: 'The virtual controller is not configured. Click Repair driver, then Check again.' };
  if (/versions do not match/i.test(text)) return { code: 'DRIVER_MISMATCH', message: 'The virtual controller driver needs repair. Click Repair driver, then Check again.' };
  if (/not found|not installed|cannot load|disabled|VJOY_DLL_PATH/i.test(text)) return { code: 'DRIVER_MISSING', message: 'The virtual controller driver is missing or unavailable. Click Repair driver, then Check again.' };
  return { code: 'STARTUP_FAILED', message: 'The companion could not start. Retry; if it persists, open the logs folder and share the logs.' };
}
export const pairingRejected = 'A phone tried to connect with an old or invalid QR. Scan the current QR on your phone.';
export const connectionHelp = 'Still waiting for your phone. Check the shared network, allow local-network access in Chrome and review Windows private-network firewall permissions. The firewall may be blocking the connection.';
