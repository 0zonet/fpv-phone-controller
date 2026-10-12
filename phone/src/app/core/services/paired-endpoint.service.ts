import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { validEndpoint } from './connection-address';

export const ADDRESS_STORAGE_KEY = 'fpv-controller-address';

/** The last paired WebSocket endpoint (with its token), shared by the flight screen, settings and /connect. */
@Injectable({ providedIn: 'root' })
export class PairedEndpointService {
  private readonly value = signal(this.read());
  readonly endpoint = this.value.asReadonly();
  /** Stores a valid endpoint and returns it, or null when invalid. */
  save(address: string): string | null {
    const endpoint = validEndpoint(address);
    if (!endpoint) return null;
    this.value.set(endpoint);
    try { localStorage.setItem(ADDRESS_STORAGE_KEY, endpoint); } catch { /* Storage may be disabled. */ }
    return endpoint;
  }
  private read(): string {
    try { const stored = localStorage.getItem(ADDRESS_STORAGE_KEY); if (stored) return validEndpoint(stored) ?? ''; } catch { /* Use host fallback. */ }
    return validEndpoint(environment.defaultWebSocketEndpoint) ?? '';
  }
}
