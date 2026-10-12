import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { servePhone } from './static-phone.js';
test('local preview serves self-hosted fonts with the woff2 MIME type', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fpv-phone-'));
  mkdirSync(join(directory, 'fonts'));
  writeFileSync(join(directory, 'fonts', 'urbanist-latin-wght-normal.woff2'), 'wOF2');
  const server = createServer(servePhone(directory));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch('http://127.0.0.1:' + port + '/fonts/urbanist-latin-wght-normal.woff2');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'font/woff2');
  } finally {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
