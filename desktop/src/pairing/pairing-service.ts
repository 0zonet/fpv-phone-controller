import QRCode from 'qrcode';
import { usefulAddresses } from '../network/local-network.js';
import { createPairingPayload, createPairingUrl } from '../../../shared/src/pairing.js';
export { createPairingPayload, encodePairingPayload, createPairingUrl } from '../../../shared/src/pairing.js';

export class PairingService {
  getAddresses(): ReturnType<typeof usefulAddresses> { return usefulAddresses(); }
  async create(baseUrl: string, host: string, port: number, token: string): Promise<{ url: string; qrPngBase64: string }> {
    const url = createPairingUrl(baseUrl, createPairingPayload(host, port, token));
    const image = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 4, width: 320 });
    return { url, qrPngBase64: image.slice(image.indexOf(',') + 1) };
  }
}
