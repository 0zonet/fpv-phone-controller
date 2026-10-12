# Third-party notices

FPV Phone Controller redistribuye los componentes de abajo. Los textos completos de cada licencia se copian en `licenses/` (repositorio) y en `{app}\licenses\` (instalación de Windows).

Auditoría: 2026-10-12, versión `0.4.0-beta.2`. Se generó a partir de lo que **realmente se distribuye**: el `3rdpartylicenses.txt` de Angular para la PWA, el metafile de esbuild para el backend (`desktop/src/distribution/windows-entry.ts`) y los archivos que copia `scripts/build-desktop.mjs`. Las herramientas de build y test que no se distribuyen aparecen al final.

**Resultado: todas las dependencias distribuidas tienen licencias permisivas (MIT, Apache-2.0, 0BSD, BSD-3-Clause, OFL-1.1, Inno Setup License; vJoy es MIT). Ninguna es GPL, LGPL, AGPL ni source-available, y ninguna impide cobrar, pedir donaciones ni vender el producto.**

## PWA (`phone/`, desplegada en Vercel y copiada en `{app}\phone`)

| Componente | Versión | Licencia | URL |
|---|---|---|---|
| @angular/core | 20.3.33 | MIT | https://github.com/angular/angular |
| @angular/common | 20.3.33 | MIT | https://github.com/angular/angular |
| @angular/platform-browser | 20.3.33 | MIT | https://github.com/angular/angular |
| @angular/router | 20.3.33 | MIT | https://github.com/angular/angular |
| @angular/service-worker | 20.3.33 | MIT | https://github.com/angular/angular |
| rxjs | 7.8.2 | Apache-2.0 | https://github.com/reactivex/rxjs |
| tslib | 2.8.1 | 0BSD | https://github.com/Microsoft/tslib |
| jsQR (fallback del escáner QR, chunk cargado bajo demanda) | 1.4.0 | Apache-2.0 | https://github.com/cozmo/jsQR |
| Urbanist (variable, subset latin, vía @fontsource-variable/urbanist 5.3.0) | 5.3.0 | OFL-1.1 | https://github.com/coreyhu/Urbanist |
| Doto (variable, subset latin, vía @fontsource-variable/doto 5.3.0) | 5.3.0 | OFL-1.1 | https://github.com/oliverlalan/Doto |
| Martian Mono (variable, subset latin, vía @fontsource-variable/martian-mono 5.3.0) | 5.3.0 | OFL-1.1 | https://github.com/evilmartians/mono |

Las fuentes se sirven en `/fonts/` junto a su licencia (`/fonts/*-OFL.txt`). La OFL permite usarlas y redistribuirlas en productos comerciales; lo único que prohíbe es vender las fuentes por separado.

## Backend del companion (`{app}\companion.cjs` y `{app}\node_modules`)

| Componente | Versión | Licencia | URL | Cómo se distribuye |
|---|---|---|---|---|
| ws | 8.22.0 | MIT | https://github.com/websockets/ws | Dentro del bundle `companion.cjs` |
| qrcode | 1.5.4 | MIT | https://github.com/soldair/node-qrcode | Dentro del bundle |
| pngjs | 5.0.0 | MIT | https://github.com/lukeapage/pngjs | Dentro del bundle (dependencia de qrcode) |
| dijkstrajs | 1.0.3 | MIT | https://github.com/tcort/dijkstrajs | Dentro del bundle (dependencia de qrcode) |
| koffi | 3.3.2 | MIT | https://github.com/Koromix/koffi | `node_modules/koffi` (FFI para `vJoyInterface.dll`) |
| @koromix/koffi-win32-x64 | 3.3.2 | MIT | https://github.com/Koromix/koffi | `node_modules/@koromix/koffi-win32-x64` (binario nativo) |
| Node.js runtime (`runtime\companion-engine.exe`) | la del build (Node 24 x64; hoy v24.21.0) | MIT + componentes de terceros | https://github.com/nodejs/node/blob/main/LICENSE | Copia de `node.exe` |

Sobre Node.js: su `LICENSE` (copiado a `licenses\node.txt` en cada build) agrupa las licencias de V8, libuv, OpenSSL, ICU, zlib, nghttp2, undici, etc. Todas son permisivas (MIT, BSD, Apache-2.0, ICU/Unicode, zlib). El único texto GPL que aparece corresponde a dos scripts de build de ICU (`aclocal.m4` y `config.guess`) que no forman parte de `node.exe` y además llevan la excepción de Autoconf.

Sobre koffi: versiones antiguas de koffi se publicaron con LGPL; la 3.3.2 que se distribuye es MIT (`node_modules/koffi/LICENSE.txt`). Si se actualiza koffi, conviene volver a comprobarlo.

## Ventana de Windows (`FPVPhoneController.exe`)

Compilada con el `csc.exe` de .NET Framework 4.x. Usa ensamblados de .NET Framework que forman parte de Windows (`System.Windows.Forms`, `System.Drawing`, `System.Web.Extensions`), que no se redistribuyen, y el SDK de WebView2 para mostrar la UI HTML (`{app}\ui`, con las mismas fuentes OFL de la PWA).

| Componente | Versión | Licencia | URL | Cómo se distribuye |
|---|---|---|---|---|
| Microsoft.Web.WebView2 SDK (`Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.WinForms.dll`, `WebView2Loader.dll` x64) | 1.0.4191.47 | BSD-3-Clause (© Microsoft) | https://www.nuget.org/packages/Microsoft.Web.WebView2 | DLL firmadas por Microsoft junto al exe; licencia en `licenses\WebView2-LICENSE.txt` |

El Runtime de WebView2 (Edge) viene con Windows 11 y no se redistribuye.

## Driver de joystick virtual (`{app}\vjoy\`)

| Componente | Versión | Licencia | URL |
|---|---|---|---|
| vJoy (instalador oficial `vJoySetup_v2.2.2.0_Win10_Win11.exe`, sin modificar) | 2.2.2.0 | MIT (© 2017 Shaul Eizikovich) | https://github.com/BrunnerInnovation/vJoy |

Se redistribuye el instalador firmado por Brunner Elektronik AG, verificado con SHA-256 `ef569a3105cd301b89580f18f60c66b339e95296acf2c0dfcaf4b4bbf8ab68fe`. Su licencia está en `licenses/vJoy-LICENSE.txt` y se menciona en Advanced. "vJoy" no se usa como nombre ni marca del producto. Ese instalador lleva dentro, además, componentes de Microsoft que vJoy redistribuye (runtime de Visual C++ y `hidkmdf.sys` del WDK) bajo los términos de redistribución de Microsoft. No los extraemos ni los redistribuimos por separado.

## Instalador (`FPVPhoneControllerSetup.exe`)

| Componente | Versión | Licencia | URL |
|---|---|---|---|
| Inno Setup (stub del instalador y desinstalador) | 7.1.0 | Inno Setup License (permisiva, estilo zlib; permite uso comercial) | https://jrsoftware.org/isinfo.php |

El `license.txt` incluido con Inno Setup 7.1.0 permite expresamente el uso comercial y solo exige conservar los avisos de copyright y no atribuirse la autoría. No he comprobado si jrsoftware.org pide además algo a los usuarios comerciales fuera de ese texto; conviene revisarlo antes de monetizar.

## Pendiente en fases posteriores

Se añadirán a este archivo cuando entren en el producto:

## Herramientas de build y test (no se distribuyen)

Angular CLI y `@angular/build`, esbuild, TypeScript, tsx, `@types/*` y el compilador de Inno Setup solo se usan para construir o probar (jsQR, además de en la PWA, se usa en `scripts/test-package.mjs`). En todo el árbol de `node_modules/` y `phone/node_modules/` (unos 420 paquetes) hay licencias MIT, ISC, Apache-2.0, BSD-2/3, BlueOak-1.0.0, 0BSD y CC0-1.0, además de `caniuse-lite` (CC-BY-4.0, datos de navegadores) y `spdx-exceptions` (CC-BY-3.0). Ninguna es GPL, LGPL ni AGPL, y ninguna llega al producto final.

## Cómo repetir la auditoría

1. PWA: `npm --prefix phone run build` y revisar `phone/dist/phone/3rdpartylicenses.txt`.
2. Backend: ejecutar esbuild con `metafile: true` sobre `desktop/src/distribution/windows-entry.ts` y listar los paquetes de `node_modules` que aparecen en `metafile.inputs`.
3. Revisar los archivos que `scripts/build-desktop.mjs` copia a `dist/windows` (`node_modules`, `runtime`, `licenses`).
