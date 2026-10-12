import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const version = '7.1.0';
const digest = '0362a383ed217d4c4239b5933866dd96d3eb2102737da92f80f6057a4b40df2f';
const vJoy = { version: '2.2.2.0', file: 'vJoySetup_v2.2.2.0_Win10_Win11.exe',
  url: 'https://github.com/BrunnerInnovation/vJoy/releases/download/v2.2.2.0/vJoySetup_v2.2.2.0_Win10_Win11.exe',
  sha256: 'ef569a3105cd301b89580f18f60c66b339e95296acf2c0dfcaf4b4bbf8ab68fe' };
/** Official signed BrunnerInnovation vJoy installer, cached in .tools and pinned by SHA-256. Never committed. */
export async function vJoyInstaller(root) {
  const cache = join(root, '.tools', 'vjoy-' + vJoy.version);
  const installer = join(cache, vJoy.file);
  const verified = content => createHash('sha256').update(content).digest('hex') === vJoy.sha256;
  try { if (verified(await readFile(installer))) return installer; } catch {}
  console.log('Downloading vJoy ' + vJoy.version + ' from ' + vJoy.url);
  const response = await fetch(vJoy.url);
  if (!response.ok) throw new Error('Cannot download the official vJoy installer.');
  const content = Buffer.from(await response.arrayBuffer());
  if (!verified(content)) throw new Error('vJoy installer SHA-256 mismatch.');
  await mkdir(cache, { recursive: true });
  await writeFile(installer, content);
  return installer;
}
const webView2 = { version: '1.0.4191.47',
  url: 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4191.47/microsoft.web.webview2.1.0.4191.47.nupkg',
  sha256: 'f492bbf547d0da329553b6727435b677579b1e9f91cc9e4a1ad029366d5f23d0',
  files: ['lib/net462/Microsoft.Web.WebView2.Core.dll', 'lib/net462/Microsoft.Web.WebView2.WinForms.dll', 'runtimes/win-x64/native/WebView2Loader.dll', 'LICENSE.txt'] };
/** Official Microsoft.Web.WebView2 NuGet package (BSD-3-Clause), pinned by SHA-256 and extracted to .tools. Never committed. */
export async function webView2Sdk(root) {
  const cache = join(root, '.tools', 'webview2-' + webView2.version);
  const result = Object.fromEntries(webView2.files.map(file => [file.split('/').pop(), join(cache, ...file.split('/'))]));
  try { for (const file of Object.values(result)) await access(file); return result; } catch {}
  console.log('Downloading WebView2 SDK ' + webView2.version + ' from nuget.org');
  const response = await fetch(webView2.url);
  if (!response.ok) throw new Error('Cannot download the WebView2 SDK package.');
  const content = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(content).digest('hex') !== webView2.sha256) throw new Error('WebView2 SDK SHA-256 mismatch.');
  await mkdir(cache, { recursive: true });
  const archive = join(cache, 'webview2.zip');
  await writeFile(archive, content);
  // Windows 10+ ships bsdtar, which reads .zip (.nupkg) archives.
  execFileSync(join(process.env.WINDIR ?? 'C:/Windows', 'System32', 'tar.exe'), ['-xf', archive, '-C', cache, ...webView2.files], { stdio: 'inherit' });
  for (const file of Object.values(result)) await access(file);
  return result;
}
export async function windowsCompiler(root) {
  if (process.env.ISCC_PATH) { await access(process.env.ISCC_PATH); return process.env.ISCC_PATH; }
  const cache = join(root, '.tools', 'inno-' + version);
  const compiler = join(cache, 'ISCC.exe');
  try { await access(compiler); return compiler; } catch {}
  await mkdir(cache, { recursive: true });
  const setup = join(cache, 'compiler-setup.exe');
  const response = await fetch('https://github.com/jrsoftware/issrc/releases/download/is-7_1_0/innosetup-7.1.0-x64.exe');
  if (!response.ok) throw new Error('Cannot download the official Inno Setup compiler.');
  const content = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(content).digest('hex') !== digest) throw new Error('Inno compiler SHA-256 mismatch.');
  await writeFile(setup, content);
  console.log('Preparing official Inno Setup ' + version + ' x64 in portable mode (no system installation).');
  execFileSync(setup, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/SP-', '/CURRENTUSER', '/PORTABLE=1',
    '/NOICONS', '/DIR=' + cache], { stdio: 'inherit', windowsHide: true, timeout: 120000 });
  await access(compiler);
  return compiler;
}
