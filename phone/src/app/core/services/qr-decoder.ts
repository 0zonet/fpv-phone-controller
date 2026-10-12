/** Frame source for QR decoding: a camera frame drawn into a canvas, or a decoded image in tests. */
export interface QrFrame { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number; }
export interface QrDetector { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>; }
type DetectorConstructor = { new (options: { formats: string[] }): QrDetector; getSupportedFormats?(): Promise<string[]> };

/**
 * D7: the native BarcodeDetector when it supports QR (Chrome Android with Play Services),
 * otherwise null and the caller falls back to jsQR.
 */
export async function nativeQrDetector(scope: unknown = globalThis): Promise<QrDetector | null> {
  const Detector = (scope as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const formats = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : ['qr_code'];
    return formats.includes('qr_code') ? new Detector({ formats: ['qr_code'] }) : null;
  } catch { return null; }
}

let jsQrModule: Promise<typeof import('jsqr').default> | undefined;
/** jsQR is loaded on demand (its own lazy chunk) only when the native detector is missing. */
export async function decodeWithJsQr(frame: QrFrame): Promise<string | null> {
  jsQrModule ??= import('jsqr').then(module => (module as unknown as { default: typeof import('jsqr').default }).default ?? (module as unknown as typeof import('jsqr').default));
  const jsQR = await jsQrModule;
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

/** Why the camera cannot be used, in user terms, or '' when it can. */
export function cameraUnavailableReason(scope: { isSecureContext?: boolean; navigator?: { mediaDevices?: unknown } }): string {
  if (!scope.isSecureContext) return 'insecure';
  if (!scope.navigator?.mediaDevices) return 'unsupported';
  return '';
}
