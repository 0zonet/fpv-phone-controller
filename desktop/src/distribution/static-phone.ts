import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
export function servePhone(directory: string) {
  const base = resolve(directory);
  return (request: IncomingMessage, response: ServerResponse): void => {
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    let file: string;
    try {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      file = resolve(base, '.' + (path === '/' || path === '/connect' ? '/index.html' : path));
      if (!file.startsWith(base + sep)) { response.writeHead(403).end(); return; }
    } catch { response.writeHead(400).end(); return; }
    void readFile(file).then(content => {
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }).end(content);
    }, () => response.writeHead(404).end());
  };
}
