import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 is required for this native build.');
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Build the distribution with Node 24 x64.');
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const distributionDefaults = JSON.parse(await readFile(join(root, 'distribution.config.json'), 'utf8'));
const pwaUrl = process.env.PWA_URL ?? distributionDefaults.pwaUrl;
if (pwaUrl && new URL(pwaUrl).protocol !== 'https:') throw new Error('PWA_URL must be HTTPS.');
const output = join(root, 'dist/windows');
await mkdir(join(output, 'runtime'), { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['desktop/src/distribution/windows-entry.ts'],
  outfile: join(output, 'companion.cjs'), bundle: true, platform: 'node', format: 'cjs', target: 'node24',
  external: ['koffi', 'bufferutil', 'utf-8-validate'], sourcemap: false });
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
await writeFile(assembly, '[assembly:System.Reflection.AssemblyVersion("' + version + '.0")]\n' +
  '[assembly:System.Reflection.AssemblyFileVersion("' + version + '.0")]\n');
execFileSync(csc, ['/nologo', '/target:winexe', '/platform:x64', '/optimize+',
  '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll',
  '/win32icon:' + join(root, 'desktop/windows/app.ico'), '/out:' + join(output, 'FPVPhoneController.exe'),
  join(root, 'desktop/windows/CompanionWindow.cs'), assembly], { stdio: 'inherit' });
await copyFile(join(root, 'USER_README.md'), join(output, 'USER_README.md'));
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = await readFile(join(root, 'USER_README.md'), 'utf8');
await writeFile(join(output, 'USER_README.html'), '<!doctype html><html lang="es"><meta charset="utf-8"><title>FPV Phone Controller — Ayuda</title><style>body{max-width:850px;margin:40px auto;padding:24px;font:17px/1.6 system-ui}pre{white-space:pre-wrap;font:inherit}</style><h1>FPV Phone Controller</h1><p>' +
  (pwaUrl ? 'PWA: <a href="' + escape(pwaUrl) + '">' + escape(pwaUrl) + '</a>' : 'Versión de prueba local; la URL pública de la PWA aún no está configurada.') + '</p><pre>' + escape(text) + '</pre></html>');
await mkdir(join(output, 'licenses'), { recursive: true });
await copyFile(join(root, 'phone/dist/phone/3rdpartylicenses.txt'), join(output, 'licenses/frontend.txt'));
for (const [source, target] of [['ws/LICENSE', 'ws.txt'], ['koffi/LICENSE.txt', 'koffi.txt']]) {
  try { await copyFile(join(root, 'node_modules', source), join(output, 'licenses', target)); }
  catch { if (source.startsWith('koffi')) await copyFile(join(root, 'node_modules/koffi/LICENSE'), join(output, 'licenses', target)); else throw new Error('Missing dependency license'); }
}
const nodeLicense = await fetch('https://raw.githubusercontent.com/nodejs/node/' + process.version + '/LICENSE');
if (!nodeLicense.ok) throw new Error('Cannot retrieve Node.js license for the bundled runtime.');
await writeFile(join(output, 'licenses/node.txt'), await nodeLicense.text());
console.log('Windows app built: ' + output);
if (!pwaUrl) console.log('LOCAL PREVIEW: build with PWA_URL=https://your-domain.vercel.app when published.');
