import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, copyFile, access, rm } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { vJoyInstaller } from './windows-tools.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 is required for this native build.');
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Build the distribution with Node 24 x64.');
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const distributionDefaults = JSON.parse(await readFile(join(root, 'distribution.config.json'), 'utf8'));
const pwaUrl = process.env.PWA_URL ?? distributionDefaults.pwaUrl;
if (pwaUrl && new URL(pwaUrl).protocol !== 'https:') throw new Error('PWA_URL must be HTTPS.');
const output = join(root, 'dist/windows');
if (resolve(output) !== resolve(root, 'dist/windows')) throw new Error('Invalid build directory');
await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'runtime'), { recursive: true });
for (const [entry, file] of [['windows-entry.ts', 'companion.cjs'], ['vjoy-setup-entry.ts', 'vjoy-setup.cjs']])
  await build({ absWorkingDir: root, entryPoints: ['desktop/src/distribution/' + entry],
    outfile: join(output, file), bundle: true, platform: 'node', format: 'cjs', target: 'node24',
    external: ['koffi', 'bufferutil', 'utf-8-validate'], sourcemap: false });
const vJoySetup = await vJoyInstaller(root);
await mkdir(join(output, 'vjoy'), { recursive: true });
await copyFile(vJoySetup, join(output, 'vjoy', basename(vJoySetup)));
await copyFile(process.execPath, join(output, 'runtime/companion-engine.exe'));
const dependencies = ['koffi/package.json', 'koffi/index.cjs', 'koffi/src/koffi/index.cjs',
  'koffi/src/koffi/src/static.cjs', 'koffi/src/koffi/src/trampolines.cjs'];
for (const file of dependencies) {
  const destination = join(output, 'node_modules', file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, 'node_modules', file), destination);
}
await cp(join(root, 'node_modules/@koromix/koffi-win32-x64'), join(output, 'node_modules/@koromix/koffi-win32-x64'), { recursive: true });
await cp(join(root, 'phone/dist/phone/browser'), join(output, 'phone'), { recursive: true });
await writeFile(join(output, 'distribution.json'), JSON.stringify({ version, pwaUrl }, null, 2));
const csc = join(process.env.WINDIR ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
await access(csc);
const assembly = join(root, '.tools', 'AssemblyInfo.cs');
await mkdir(dirname(assembly), { recursive: true });
const match = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(version);
if (!match) throw new Error('Unsupported product version');
const windowsVersion = match.slice(1, 4).join('.') + '.' + (match[4] ?? '0');
await writeFile(assembly, '[assembly:System.Reflection.AssemblyVersion("' + windowsVersion + '")]\n' +
  '[assembly:System.Reflection.AssemblyFileVersion("' + windowsVersion + '")]\n' +
  '[assembly:System.Reflection.AssemblyInformationalVersion("' + version + '")]\n');
execFileSync(csc, ['/nologo', '/target:winexe', '/platform:x64', '/optimize+',
  '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll',
  '/win32icon:' + join(root, 'desktop/windows/app.ico'), '/out:' + join(output, 'FPVPhoneController.exe'),
  join(root, 'desktop/windows/CompanionWindow.cs'), join(root, 'desktop/windows/DesktopConfiguration.cs'), assembly], { stdio: 'inherit' });
await copyFile(join(root, 'USER_README.md'), join(output, 'USER_README.md'));
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = await readFile(join(root, 'USER_README.md'), 'utf8');
await writeFile(join(output, 'USER_README.html'), '<!doctype html><html lang="es"><meta charset="utf-8"><title>FPV Phone Controller — Ayuda</title><style>body{max-width:850px;margin:40px auto;padding:24px;font:17px/1.6 system-ui}pre{white-space:pre-wrap;font:inherit}</style><h1>FPV Phone Controller</h1><p>' +
  (pwaUrl ? 'PWA: <a href="' + escape(pwaUrl) + '">' + escape(pwaUrl) + '</a>' : 'Versión de prueba local; la URL pública de la PWA aún no está configurada.') + '</p><pre>' + escape(text) + '</pre></html>');
await mkdir(join(output, 'licenses'), { recursive: true });
await copyFile(join(root, 'phone/dist/phone/3rdpartylicenses.txt'), join(output, 'licenses/frontend.txt'));
await cp(join(root, 'licenses'), join(output, 'licenses'), { recursive: true });
await copyFile(join(root, 'THIRD_PARTY_NOTICES.md'), join(output, 'THIRD_PARTY_NOTICES.md'));
for (const [source, target] of [['ws/LICENSE', 'ws.txt'], ['koffi/LICENSE.txt', 'koffi.txt']]) {
  try { await copyFile(join(root, 'node_modules', source), join(output, 'licenses', target)); }
  catch { if (source.startsWith('koffi')) await copyFile(join(root, 'node_modules/koffi/LICENSE'), join(output, 'licenses', target)); else throw new Error('Missing dependency license'); }
}
const nodeLicense = await fetch('https://raw.githubusercontent.com/nodejs/node/' + process.version + '/LICENSE');
if (!nodeLicense.ok) throw new Error('Cannot retrieve Node.js license for the bundled runtime.');
await writeFile(join(output, 'licenses/node.txt'), await nodeLicense.text());
const sourceRequire = createRequire(import.meta.url);
const qrRequire = createRequire(sourceRequire.resolve('qrcode'));
for (const name of ['qrcode', 'pngjs', 'dijkstrajs']) {
  const packagePath = name === 'qrcode' ? sourceRequire.resolve('qrcode/package.json') : qrRequire.resolve(name + '/package.json');
  await copyFile(join(dirname(packagePath), name === 'dijkstrajs' ? 'LICENSE.md' : 'LICENSE'), join(output, 'licenses', name + '.txt'));
}
console.log('Windows app built: ' + output);
if (!pwaUrl) console.log('LOCAL PREVIEW: build with PWA_URL=https://your-domain.vercel.app when published.');
