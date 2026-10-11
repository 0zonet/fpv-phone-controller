import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'win32' || process.arch !== 'x64' || Number(process.versions.node.split('.')[0]) !== 24)
  throw new Error('Release requires Windows x64 and Node 24.');
const run = script => execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm run ' + script], {cwd:root,stdio:'inherit',windowsHide:true});
run('test'); run('build'); run('build:native'); run('test:package'); run('package:installer');
const release = new URL('../release/', import.meta.url);
await mkdir(release, {recursive:true});
const metadata = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
metadata.file = 'FPVPhoneController-' + metadata.version + '-Setup.exe';
metadata.channel = 'beta';
await copyFile(new URL('../dist/FPVPhoneControllerSetup.exe', import.meta.url), new URL(metadata.file, release));
await writeFile(new URL('release.json', release), JSON.stringify(metadata, null, 2));
await writeFile(new URL('SHA256SUMS.txt', release), metadata.sha256 + '  ' + metadata.file + '\n');
for (const name of ['USER_README.md', 'CLEAN_PC_CHECKLIST.md']) await copyFile(new URL('../' + name, import.meta.url), new URL(name, release));
console.log('Release ready: ' + fileURLToPath(release));
