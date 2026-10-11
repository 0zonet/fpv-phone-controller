import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
export class StructuredLogger {
  readonly directory: string;
  available = true;
  failure = '';
  constructor(dataDirectory: string, private readonly version: string, private readonly maxBytes = 2 * 1024 * 1024) {
    this.directory = join(dataDirectory, 'logs');
    try { mkdirSync(this.directory, { recursive: true }); } catch { this.available = false; }
  }
  write(event: string, details: Record<string, string | number | boolean> = {}, level = 'info'): void {
    if (!this.available) return;
    try {
      const file = join(this.directory, 'companion.jsonl');
      if (existsSync(file) && statSync(file).size >= this.maxBytes) {
        const oldest = file + '.4'; if (existsSync(oldest)) rmSync(oldest);
        for (let i = 3; i >= 1; i--) if (existsSync(file + '.' + i)) renameSync(file + '.' + i, file + '.' + (i + 1));
        renameSync(file, file + '.1');
      }
      const safe = Object.fromEntries(Object.entries(details).map(([key, value]) => [key,
        typeof value === 'string' ? value.replace(/token=[^\s&]+/gi, 'token=[redacted]').replace(/\b[a-f0-9]{48}\b/gi, '[redacted]') : value]));
      appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), level, event, version: this.version, ...safe }) + '\n', 'utf8');
    } catch (error) { this.available = false; this.failure = String(error); }
  }
}
