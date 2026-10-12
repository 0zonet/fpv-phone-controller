import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cameraUnavailableReason, decodeWithJsQr, nativeQrDetector } from './qr-decoder';
import { createPairingPayload, createPairingUrl } from '../../../../../shared/src/pairing';
import { PairingService } from './pairing.service';

// qrcode and pngjs live in the repository root (they generate the companion's QR).
const require = createRequire(__filename);
const QRCode = require('qrcode') as { toBuffer(text: string, options: object): Promise<Buffer> };
const { PNG } = createRequire(require.resolve('qrcode'))('pngjs') as { PNG: { sync: { read(buffer: Buffer): { data: Buffer; width: number; height: number } } } };

test('el fallback jsQR lee el QR real del companion y PairingService obtiene el endpoint', async () => {
  const token = 'd'.repeat(48);
  const url = createPairingUrl('https://fpv.brycofre.com', createPairingPayload('192.168.1.20', 8081, token));
  const png = PNG.sync.read(await QRCode.toBuffer(url, { width: 320, margin: 4 }));
  const text = await decodeWithJsQr({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
  assert.equal(text, url);
  assert.equal(new PairingService().parsePairingUrl(text!), 'ws://192.168.1.20:8081/?token=' + token);
});
test('un fotograma sin QR devuelve null', async () => {
  const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  assert.equal(await decodeWithJsQr({ data: blank, width: 64, height: 64 }), null);
});
test('BarcodeDetector solo se usa si existe y soporta qr_code', async () => {
  assert.equal(await nativeQrDetector({}), null);
  class NoQr { static async getSupportedFormats() { return ['ean_13']; } async detect() { return []; } }
  assert.equal(await nativeQrDetector({ BarcodeDetector: NoQr }), null);
  class WithQr { constructor(readonly options: { formats: string[] }) {} static async getSupportedFormats() { return ['qr_code']; } async detect() { return []; } }
  const detector = await nativeQrDetector({ BarcodeDetector: WithQr });
  assert.ok(detector instanceof WithQr); assert.deepEqual((detector as WithQr).options, { formats: ['qr_code'] });
});
test('la cámara requiere contexto seguro (no funciona en la vista previa http:// local)', () => {
  assert.equal(cameraUnavailableReason({ isSecureContext: false, navigator: { mediaDevices: {} } }), 'insecure');
  assert.equal(cameraUnavailableReason({ isSecureContext: true, navigator: {} }), 'unsupported');
  assert.equal(cameraUnavailableReason({ isSecureContext: true, navigator: { mediaDevices: {} } }), '');
});
