import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../phone/dist/phone/browser/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.name, 'FPV Phone Controller');
assert.equal(manifest.short_name, 'FPV Controller');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.id, '/');
assert.deepEqual(manifest.display_override, ['standalone', 'fullscreen']);
assert.equal(manifest.orientation, 'landscape');
for (const size of [192, 512]) {
  const icon = manifest.icons.find(icon => icon.sizes === size + 'x' + size);
  assert.ok(icon);
  const bytes = await readFile(new URL(icon.src, root));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
}
const html = await readFile(new URL('index.html', root), 'utf8');
assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
assert.match(html, /name="theme-color"/); assert.match(html, /name="mobile-web-app-capable" content="yes"/);
const ngsw = JSON.parse(await readFile(new URL('ngsw.json', root), 'utf8'));
assert.equal(ngsw.index, '/index.html'); assert.ok(ngsw.hashTable['/manifest.webmanifest']);
assert.ok(ngsw.hashTable['/icons/icon-512x512.png']);
const fonts = ngsw.assetGroups.find(group => group.name === 'fonts');
assert.equal(fonts?.installMode, 'prefetch');
for (const font of ['urbanist', 'doto', 'martian-mono']) {
  const url = '/fonts/' + font + '-latin-wght-normal.woff2';
  assert.ok(fonts.urls.includes(url) && ngsw.hashTable[url], 'Font not prefetched offline: ' + url);
}
for (const license of ['Urbanist', 'Doto', 'MartianMono']) await readFile(new URL('fonts/' + license + '-OFL.txt', root));
assert.ok((await readFile(new URL('ngsw-worker.js', root))).length > 1000);
console.log('PASS: production PWA manifest, scope, display, icons, meta tags and Angular service worker assets.');
