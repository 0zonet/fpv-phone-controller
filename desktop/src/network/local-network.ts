import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';

export interface LocalAddress { name: string; address: string; netmask: string; }
export function isPrivateIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
const bits = (address: string): number => address.split('.').reduce((value, byte) => (value << 8) | Number(byte), 0) >>> 0;
export function usefulAddresses(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()): LocalAddress[] {
  const result: LocalAddress[] = [];
  for (const [name, entries] of Object.entries(interfaces)) {
    // Exclude known virtual/tunnel adapters; unknown physical adapter names remain usable.
    if (/loopback|vethernet|hyper-v|virtualbox|vmware|docker|tailscale|zerotier|wireguard|tunnel|vpn|wsl/i.test(name)) continue;
    for (const entry of entries ?? []) if (!entry.internal && entry.family === 'IPv4' && isPrivateIpv4(entry.address)) {
      result.push({ name, address: entry.address, netmask: entry.netmask });
    }
  }
  return result.sort((a, b) => Number(!/usb|rndis|tether/i.test(a.name)) - Number(!/usb|rndis|tether/i.test(b.name)));
}
export function isLocalPeer(peer: string, local: LocalAddress): boolean {
  const address = peer.replace(/^::ffff:/, '');
  return isPrivateIpv4(address) && (bits(address) & bits(local.netmask)) === (bits(local.address) & bits(local.netmask));
}
/**
 * 'accept': local peer, allowed Origin and the session token.
 * 'invalid-token': local peer and allowed Origin but an old/wrong token. The server accepts the upgrade only to
 * close it with 4003, because a browser cannot read the HTTP status of a refused handshake.
 * 'deny': anything else, refused during the handshake.
 */
export type ConnectionDecision = 'accept' | 'invalid-token' | 'deny';
export function connectionDecision(peer: string, origin: string | undefined, requestUrl: string,
  local: LocalAddress, origins: readonly string[], token: string): ConnectionDecision {
  if (!isLocalPeer(peer, local) || !origin || !origins.includes(origin)) return 'deny';
  try {
    const candidate = new URL(requestUrl, 'http://localhost').searchParams.get('token') ?? '';
    const received = Buffer.from(candidate), expected = Buffer.from(token);
    return received.length === expected.length && timingSafeEqual(received, expected) ? 'accept' : 'invalid-token';
  } catch { return 'deny'; }
}
export function authorizedConnection(peer: string, origin: string | undefined, requestUrl: string,
  local: LocalAddress, origins: readonly string[], token: string): boolean {
  return connectionDecision(peer, origin, requestUrl, local, origins, token) === 'accept';
}
