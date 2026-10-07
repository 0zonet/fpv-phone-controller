import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DistributionConfig { version: string; pwaUrl: string; }
export function loadDistributionConfig(directory: string): DistributionConfig {
  const parsed: unknown = JSON.parse(readFileSync(join(directory, 'distribution.json'), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || typeof parsed.version !== 'string' ||
      !('pwaUrl' in parsed) || typeof parsed.pwaUrl !== 'string') throw new Error('Invalid distribution configuration.');
  if (parsed.pwaUrl && new URL(parsed.pwaUrl).protocol !== 'https:') throw new Error('Public PWA URL must use HTTPS.');
  return { version: parsed.version, pwaUrl: parsed.pwaUrl };
}
