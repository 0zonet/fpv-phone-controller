import { Injectable } from '@angular/core';
import { decodePairingPayload, pairingEndpoint } from '../../../../../shared/src/pairing';
@Injectable({ providedIn: 'root' })
export class PairingService {
  parsePairingUrl(address: string): string {
    const url = new URL(address);
    if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== '/connect'
      || url.username || url.password || url.hash || url.searchParams.getAll('data').length !== 1
      || [...url.searchParams.keys()].some(key => key !== 'data')) throw new Error('Invalid pairing link');
    return pairingEndpoint(decodePairingPayload(url.searchParams.get('data') ?? ''));
  }
}
