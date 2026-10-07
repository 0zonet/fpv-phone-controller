export interface PairingPayload {
  readonly version: 1;
  readonly host: string;
  readonly port: number;
  /** Per-launch companion authorization; encoding is not encryption. */
  readonly token: string;
}
export function isPrivateHost(host: unknown): host is string {
  if (typeof host !== 'string' || !/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(host)) return false;
  const parts = host.split('.').map(Number);
  if (parts.some(part => part > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}
export function validatePairingPayload(value: unknown): PairingPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pairing payload');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'host,port,token,version'
    || data['version'] !== 1 || !isPrivateHost(data['host'])
    || !Number.isInteger(data['port']) || (data['port'] as number) < 1 || (data['port'] as number) > 65535
    || typeof data['token'] !== 'string' || !/^[a-f0-9]{48}$/.test(data['token'])) {
    throw new Error('Invalid pairing payload');
  }
  return { version: 1, host: data['host'], port: data['port'] as number, token: data['token'] };
}
export function createPairingPayload(host: string, port: number, token: string): PairingPayload {
  return validatePairingPayload({ version: 1, host, port, token });
}
export function encodePairingPayload(payload: PairingPayload): string {
  return btoa(JSON.stringify(validatePairingPayload(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodePairingPayload(encoded: string): PairingPayload {
  if (!encoded || encoded.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid pairing encoding');
  try {
    const raw = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    if (btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== encoded) throw new Error('Non-canonical encoding');
    return validatePairingPayload(JSON.parse(raw) as unknown);
  } catch { throw new Error('Invalid pairing payload'); }
}
export function pairingEndpoint(payload: PairingPayload): string {
  const data = validatePairingPayload(payload);
  return 'ws://' + data.host + ':' + data.port + '/?token=' + data.token;
}
export function createPairingUrl(baseUrl: string, payload: PairingPayload): string {
  const url = new URL(baseUrl);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && isPrivateHost(url.hostname)))) {
    throw new Error('Pairing requires HTTPS or a local preview');
  }
  url.pathname = '/connect'; url.search = ''; url.hash = '';
  url.searchParams.set('data', encodePairingPayload(payload));
  return url.href;
}
