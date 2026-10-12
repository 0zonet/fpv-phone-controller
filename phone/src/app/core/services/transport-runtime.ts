import { InjectionToken } from '@angular/core';
import { openLocalWebSocket } from './local-websocket';

export interface TransportSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'error', listener: () => void): void;
  /** `code` tells a PC-side disconnect (4001) or a rejected pairing (4003) apart from a lost connection. */
  addEventListener(type: 'close', listener: (event: { readonly code: number }) => void): void;
  /** PC → phone messages (hello, ack). Companions older than protocol 2 never send any. */
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
}
export interface TransportClock {
  now(): number;
  timestamp(): number;
  schedule(callback: () => void, delay: number): () => void;
}
export const SOCKET_FACTORY = new InjectionToken<(url: string) => TransportSocket>('Socket factory', {
  providedIn: 'root', factory: () => url => openLocalWebSocket(url)
});
export const TRANSPORT_CLOCK = new InjectionToken<TransportClock>('Transport clock', {
  providedIn: 'root', factory: () => ({
    now: () => performance.now(), timestamp: () => Date.now(),
    schedule: (callback, delay) => { const timer = setTimeout(callback, delay); return () => clearTimeout(timer); }
  })
});
