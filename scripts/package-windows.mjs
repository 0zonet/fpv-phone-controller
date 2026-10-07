import { execFileSync } from 'node:child_process';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { windowsCompiler } from './windows-tools.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiler = await windowsCompiler(root);
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
execFileSync(compiler, ['/DAppVersion=' + version, join(root, 'desktop/windows/installer.iss')], { stdio: 'inherit' });
const installer = join(root, 'dist/FPVPhoneControllerSetup.exe');
const distribution = JSON.parse(await readFile(join(root, 'dist/windows/distribution.json'), 'utf8'));
await writeFile(join(root, 'dist/release.json'), JSON.stringify({
  version, platform: 'win32-x64', file: 'FPVPhoneControllerSetup.exe', bytes: (await stat(installer)).size,
  sha256: createHash('sha256').update(await readFile(installer)).digest('hex'),
  pwaUrl: distribution.pwaUrl, channel: distribution.pwaUrl ? 'candidate' : 'local-preview', signed: false
}, null, 2));
