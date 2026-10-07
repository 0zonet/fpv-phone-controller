# Distribución del MVP

## Decisión técnica

Se reutilizan protocolo, ControllerMapper, ControllerSession/failsafe, validación y VJoyController.
La UI desktop es WinForms compilada con .NET Framework 4.x de Windows 11; no requiere Electron, WebView2 ni descargar otro runtime .NET.
El backend TypeScript se compila y agrupa con esbuild. Se distribuye Node x64 como runtime privado, junto a Koffi x64. El usuario no instala Node.

Node SEA es una alternativa oficial, pero en este MVP aumenta el trabajo de extracción/carga del addon nativo sin eliminar la necesidad de recursos externos. Tauri añadiría Rust y otro bridge; Electron añade un navegador que esta UI no necesita.
El instalador usa Inno Setup 7.1.0 x64, por usuario, con identidad estable, accesos directos y desinstalador. El primer empaquetado descarga el compilador oficial, comprueba un SHA-256 fijo y lo extrae en modo portable a .tools; no lo instala en Windows. Puedes establecer ISCC_PATH para utilizar tu compilador. No se distribuye el compilador.
No hay auto-update aún. dist/release.json contiene versión, tamaño y SHA-256 para preparar futuras publicaciones. El instalador generado no está firmado.

## Builds en Windows x64

Requisitos de desarrollo: Node 24 x64, npm y Windows 11. El usuario final no necesita estas herramientas.

```powershell
npm ci
npm test
npm run build
npm run build:desktop
npm run package:windows
npm run test:package
```

Resultados:
- phone/dist/phone/browser: PWA estática con manifest, iconos, ngsw.json y ngsw-worker.js.
- dist/windows/FPVPhoneController.exe: ventana nativa.
- dist/windows/runtime/companion-engine.exe: runtime incluido.
- dist/FPVPhoneControllerSetup.exe: instalador para compartir.
- dist/release.json: metadatos del artefacto.

El build no copia vJoy ni ejecuta su instalador. Node se toma del runtime del desarrollador; su versión y licencia deben revisarse antes de una release. El build recupera su licencia oficial por HTTPS.

## Vercel

Importa el repositorio en Vercel usando su raíz. vercel.json configura instalación, build y carpeta pública.
No publiques dist/windows ni claves temporales del companion.
La PWA usa el service worker oficial de Angular solo en producción, cachea sus archivos y no cachea el WebSocket. El endpoint empieza vacío y se introduce en la UI.

El dominio previsto es https://fpv.brycofre.com y se configura en distribution.config.json. Para cambiarlo temporalmente:

```powershell
$env:PWA_URL = 'https://fpv.brycofre.com'
npm run package:windows
```

Se escribe el origen permitido en dist/windows/distribution.json y se incluye en el instalador. Cada versión preview de Vercel tiene otro origen: para la prueba utiliza exactamente el que incluya ese instalador.
Sin PWA_URL se usa distribution.config.json. Para generar una prueba local sin URL pública, establece PWA_URL a una cadena vacía. El dominio configurado no implica que el DNS o la publicación ya estén activos.

### Subdominio fpv.brycofre.com

En el proyecto de Vercel, Settings > Domains, agrega fpv.brycofre.com.
En el proveedor DNS de brycofre.com crea un CNAME con nombre fpv y destino exactamente igual al que muestre Vercel para ese proyecto. No adivines el destino ni añadas https:// al valor del CNAME.
Si Vercel solicita verificar la propiedad, agrega también el TXT que indique.
Espera a que Vercel confirme la configuración y el certificado HTTPS. Después verifica que /manifest.webmanifest, /ngsw.json y /ngsw-worker.js responden correctamente en ese dominio.
Referencia: https://vercel.com/docs/domains/working-with-domains/add-a-domain

## HTTPS y LAN

La PWA se sirve por HTTPS. En Chrome compatible se abre el WebSocket local usando WebSocketInit/targetAddressSpace=local y el permiso de acceso a red local. Hay fallback al constructor clásico y mensajes de error; no se desactivan controles de seguridad del navegador.
Esta compatibilidad debe verificarse en Chrome Android real antes de publicar. Firefox/Safari y motores antiguos no tienen garantizado este flujo. No se provisionan certificados locales ni se instala una CA en el teléfono.
La vista Local preview usa HTTP y sirve el build Angular para verificar el MVP en LAN; no confirma instalación PWA.

Referencias:
- https://angular.dev/ecosystem/service-workers/getting-started
- https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/security/local-network-access.md
- https://nodejs.org/api/single-executable-applications.html
- https://jrsoftware.org/isinfo.php

## Red y firewall

La distribución escucha únicamente en la IPv4 privada seleccionada, no en 0.0.0.0 ni IPv6. Filtra interfaces conocidas de VPN/VM; un nombre desconocido puede necesitar selección manual.
No añade reglas de firewall silenciosamente. Si hace falta una regla, limitar programa runtime/companion-engine.exe, TCP 8080, Private y LocalSubnet. No abrir puertos del router.
Rechaza clientes fuera de la subred, origen no autorizado o token incorrecto antes del upgrade WebSocket. Solo se admite un teléfono; se conserva validación estricta, límite de payload y failsafe.
La clave cambia al reiniciar o cambiar interfaz. Copy Address copia el endpoint completo. PC address/endpoint son datos separados y reutilizables para un QR futuro.
El transporte local ws no cifra el tráfico: solo redes de confianza. El CLI npm run desktop conserva el flujo de desarrollo original y no es el punto de entrada de distribución.

## Prueba como usuario nuevo

Usa otro Windows 11 x64 o una VM con snapshots (el driver puede necesitar entorno físico).
1. Comprueba que no están instalados Node/npm/Angular y ejecuta el Setup.
2. Con vJoy ausente, comprueba el aviso y que Install driver abre instrucciones; no debe iniciar una instalación oculta.
3. Instala/configura vJoy explícitamente y pulsa Retry. Comprueba READY/LISTENING.
4. Comparte Wi-Fi/USB, copia la dirección y prueba primero Local preview.
5. Publica en Vercel, recompila con PWA_URL e instala esa versión. En Android abre la URL HTTPS, instala la PWA y permite acceso LAN.
6. Verifica Phone CONNECTED, los cuatro ejes en joy.cpl y luego Uncrashed.
7. Cierra el companion y comprueba reset/liberación; reinícialo y verifica que hay que copiar la nueva dirección.
8. Prueba cambio de red, firewall bloqueado, origen ajeno, token antiguo, driver ocupado y puerto ocupado.
9. Desinstala desde Windows y comprueba que desaparecen app y accesos directos. vJoy es separado y permanece instalado.

test:package usa un driver fake de forma explícita para validar el artefacto sin adquirir el dispositivo real; no sustituye la prueba del instalador, Android o Uncrashed.
