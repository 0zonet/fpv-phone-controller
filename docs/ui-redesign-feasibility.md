# Factibilidad del rediseño UI — FPV Phone Controller

> Análisis sobre el **working tree actual** (rama `main`, commit `5bd82c1` + cambios sin commitear). Toda la funcionalidad de botones virtuales (`vjoy-buttons.ts`, `virtual-button/`, `controller-button.model.ts`, `buttons` en el protocolo) existe **solo en el working tree, sin commit**. Los mockups no están en `docs/design/`, sino en `fpv-ui-analisis/docs/design/`.
> No se ha ejecutado nada en un dispositivo real: las afirmaciones de rendimiento y de compatibilidad de navegador están marcadas como estimaciones.

## 1. Resumen

La **PWA** está cerca del diseño. Sticks multitouch, pointer capture, 4 estados de conexión, botones ARM/RESET/AUX, Hz enviados, pantalla completa y bloqueo de orientación ya existen. La mayor parte del trabajo es reskin, más tres piezas nuevas: ajustes con persistencia, escáner QR en la app y medición de latencia.

El **desktop** está lejos. La ventana actual es un `FlowLayoutPanel` de WinForms con controles nativos y tema claro, compilada con el `csc.exe` de .NET Framework 4 (solo C# 5). Ninguno de los efectos del diseño (vidrio, blur, brillos, fuentes propias, píldoras, animaciones) existe en WinForms sin dibujarlo a mano. El backend Node ya detecta casi todos los errores, pero apenas expone métricas y no acepta comandos más allá de `shutdown`.

**Los 3 mayores bloqueos o riesgos:**
1. **Tecnología de render del desktop.** Reproducir el diseño en WinForms puro exige dibujar todo a mano (L) y aun así hay que simplificar los efectos. La alternativa fiel (WebView2 dentro de la misma ventana WinForms) es un cambio de arquitectura que debes decidir tú.
2. **Compatibilidad de protocolo entre versiones.** La PWA se actualiza sola desde Vercel; el companion instalado no. El servidor cierra la conexión ante cualquier mensaje que no sea `controller-state` (`controller-websocket-server.ts:59`). Por eso la latencia, los ajustes enviados al PC o cualquier mensaje nuevo del teléfono **desconectarían a usuarios con un companion antiguo**, a menos que se negocie la capacidad primero.
3. **Firewall.** Hoy no se detecta: solo hay un aviso genérico a los 45 s. Detectarlo de forma fiable no es posible. Añadir la regla requiere elevación UAC, y la política documentada actual dice que no se toca el firewall (`docs/DISTRIBUTION.md:76`, `DEVELOPER_README.md:60`).

## 2. Mapa del repositorio

| Carpeta | Qué es | Tecnología y versión |
|---|---|---|
| `phone/` | PWA (sticks, botones, pairing `/connect`) | Angular **20.3** standalone, zoneless, signals; `@angular/service-worker` 20.3.33; TypeScript 5.9. Tests con `node:test` + `tsx` (sin Karma). |
| `shared/src/` | Contrato común: `ControllerMessage`, botones, pairing QR | TS puro, importado por ruta relativa desde phone y desktop |
| `desktop/src/` | **Backend del companion**: servidor WebSocket + HTTP, mapper, failsafe, driver vJoy | Node **24** x64 (empaquetado como `runtime/companion-engine.exe`), `ws` 8.18, `koffi` 3.3 (FFI a `vJoyInterface.dll`), `qrcode` 1.5 |
| `desktop/windows/` | **UI del companion** + instalador | **WinForms** sobre .NET Framework 4.x, compilado con `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` (`scripts/build-desktop.mjs:32-45`), que solo admite **C# 5**. Instalador Inno Setup 7.1 (`installer.iss`), per-user (`PrivilegesRequired=lowest`), Windows 11 (`MinVersion=10.0.22000`). |
| `scripts/` | Build, empaquetado, smoke test del paquete (`test-package.mjs` usa `--self-test` de la ventana y `jsqr`) | Node ESM |
| `vercel.json` | Despliegue de la PWA en `fpv.brycofre.com` | Sin CSP ni `Permissions-Policy` |

**Cómo se comunican:**

```
Teléfono (PWA, https://fpv.brycofre.com)
   │  WebSocket ws://IP_LAN:8080/?token=<48 hex>   (solo teléfono → PC; el PC nunca envía mensajes de aplicación)
   ▼
companion-engine.exe (Node: windows-entry.ts → companion.ts → controller-websocket-server.ts)
   │  stdout: una línea JSON de estado por cambio      ▲ stdin: solo la línea "shutdown"
   ▼                                                    │
FPVPhoneController.exe (WinForms: CompanionWindow.cs) ──┘
```

- El backend Node es un **proceso hijo** de la ventana (`CompanionWindow.StartBackend`, `CompanionWindow.cs:179`). "Retry", "Regenerate QR", "Check again" y el cambio de red **matan y relanzan** ese proceso (`Restart()`, `:178`).
- Autorización: subred local + origin permitido + token aleatorio por arranque (`local-network.ts:27-35`, `windows-entry.ts:26`).
- Servidor → teléfono: solo ping/pong de protocolo WebSocket cada 10 s (`controller-websocket-server.ts:97-103`), invisible para JavaScript.

**Mensaje WebSocket actual** (teléfono → PC, 60 Hz, `controller-transport.service.ts:74-76`, validado en `desktop/src/models/controller-message.ts`):

```json
{
  "type": "controller-state",
  "sequence": 1842,
  "timestamp": 1760198400123,
  "axes": { "throttle": 0.53, "yaw": 0.0, "pitch": -0.12, "roll": 0.31 },
  "buttons": [true, false, true, false, false, false, false, false]
}
```

`throttle` va de 0 a 1 y los otros ejes de −1 a 1. `buttons` es opcional (los clientes antiguos no lo envían) y admite como máximo 8 valores; el índice 0..7 corresponde al botón vJoy 1..8. Si el mensaje es inválido, el servidor cierra con 1008.

**Mensaje de estado backend → ventana** (stdout, `windows-entry.ts:29-33`):

```json
{"type":"status","version":"0.4.0-beta.2","virtualController":"READY","websocket":"LISTENING","phone":"DISCONNECTED",
 "port":8080,"addresses":[{"name":"Wi-Fi","address":"192.168.1.20","endpoint":"ws://192.168.1.20:8080/?token=…"}],
 "health":{"driver":"Ready","device":"Ready","websocket":"Ready","port":"Ready","network":"Ready","qr":"Ready"},
 "selectedAddress":"192.168.1.20","pwaUrl":"https://fpv.brycofre.com","localWebUrl":"http://192.168.1.20:8080",
 "logsDirectory":"…\\logs","pairingUrl":"https://fpv.brycofre.com/connect?data=…","qrPngBase64":"…","issueCode":"","message":""}
```

`issueCode` puede valer `DRIVER_MISSING`, `DRIVER_MISMATCH`, `DEVICE_BUSY`, `DEVICE_UNAVAILABLE`, `PORT_BUSY`, `NETWORK_PERMISSION`, `NETWORK_MISSING`, `QR_FAILED`, `STARTUP_FAILED`, `PHONE_LOST` o `CONNECTION_HELP`. Además existe `{"type":"fatal","message":…}`.

## 3. Tabla de factibilidad

Estado: ✅ ya existe (solo cambia la UI) · 🟡 parcial · ❌ falta lógica nueva · ⛔ no factible tal como está diseñado.
Tamaño: S (menos de medio día) · M (1–2 días) · L (más de 2 días).

### PWA

| # | Elemento | Estado | Dónde está hoy | Qué falta | Tamaño | Riesgo |
|---|---|---|---|---|---|---|
| 1a | Logo + chip "MODE 2" | ✅ | `controller-page.component.html:3` (`FPV <span>MODE 2</span>`) | SVG del logo y estilos | S | Bajo |
| 1b | Píldora con 4 estados | ✅ | `ConnectionStatus` (`connection-status.model.ts`) + `connectionLost` (`controller-transport.service.ts:15-16,49-52`); etiquetas en `connection-status.component.ts:16-18` | Restyling. Existe un 5.º estado, `error` sin `lost` ("No se pudo conectar" en el primer intento), que el mockup no contempla: hay que decidir cómo se ve. | S | Bajo |
| 1c | Frecuencia en Hz | ✅ | `packetsPerSecond`, que cuenta los mensajes **enviados** por el teléfono (`controller-transport.service.ts:65-70`) | Solo UI | S | Bajo |
| 1d | Latencia en ms | ❌ | No existe. El servidor nunca envía mensajes de aplicación; `TransportSocket` ni siquiera escucha `message` (`transport-runtime.ts:4-10`). El ping/pong de `ws` (`controller-websocket-server.ts:97-103`) no es visible desde JS. | Nuevo mensaje PC → teléfono (p. ej. `{"type":"ack","sequence":N}` cada ~500 ms) y cálculo de RTT en el teléfono. Debe ir **del PC al teléfono**: los teléfonos antiguos lo ignoran sin romper. Ver §4. | M | Medio (versionado) |
| 1e | Desconectar dentro de la píldora | ✅ | `ControllerPageComponent.disconnect()` (`controller-page.component.ts:71`) | Solo UI | S | Bajo |
| 1f | Iconos: valores en vivo, ajustes, pantalla completa | ✅ | `controller-page.component.html:5-15`, iconos en `controller-icon.component.ts` | Iconos nuevos (SVG de los mockups) | S | Bajo |
| 2a | Arrastre con pointer events + pointer capture | ✅ | `virtual-stick.component.ts:28-51` (`setPointerCapture` en la línea 34) | — | — | — |
| 2b | Multitouch real | ✅ | Cada stick guarda su propio `pointerId` e ignora los demás (`virtual-stick.component.ts:29,38`); cada botón también (`button-interaction.ts:2`) | Probar en el dispositivo tras el reskin (no lo he podido verificar en hardware) | — | Bajo |
| 2c | Retorno al centro **animado**; el throttle se mantiene | 🟡 | El retorno existe y es **instantáneo**: `releaseValue` (`stick-math.ts:33-35`) y `[yReturnToCenter]="false"` en el throttle (`controller-page.component.html:65-66`). El knob se posiciona con `left/top` en % (`virtual-stick.component.html:9`), sin transición. | Transición CSS solo visual (el valor enviado debe seguir volviendo a 0 de inmediato). Pasar de `left/top` a `transform` (ver §6). | S | Bajo |
| 2d | Lecturas numéricas por eje | 🟡 | Solo en el panel de diagnóstico (`controller-debug.component.ts`, `toFixed(3)`) | Etiquetas bajo los sticks con formato `+0.00` y su toggle (5d) | S | Bajo |
| 2e | Barra vertical de throttle + % grande | ✅ | Barra horizontal `.power-track` + `throttlePercent` (`controller-page.component.html:61-64`) | Solo UI | S | Bajo |
| 2f | Layout 900 × 416 | 🟡 | El layout actual es fluido y además soporta portrait (`controller-page.component.css:41-60`) | El mockup usa posiciones absolutas en px. Hay que traducirlo a grid/clamp para pantallas de 780–915 × 360–412 CSS px. | M | Medio |
| 3a | ARM toggle (ARMED en rojo), RESET momentáneo, AUX 1/2 toggle | ✅ *(sin commit)* | `DEFAULT_CONTROLLER_BUTTONS` (`controller-button.model.ts:3-6`), `virtual-button.component.ts`, `button-interaction.ts` | Restyling. Pintar en rojo y con el texto "ARMED" para el índice 0 activo. | S | Bajo |
| 3b | "4 botones más" (hasta 8) | 🟡 | El modelo, el protocolo y el driver ya manejan 8 (`CONTROLLER_BUTTON_COUNT`, `shared/src/index.ts:12`); en la UI solo hay 4 (`docs/VIRTUAL_BUTTONS.md`, tabla) | UI para los índices 4..7 (hoja o overlay) y sus etiquetas | M | Bajo |
| 3c | ¿El protocolo transporta botones? | ✅ *(sin commit)* | `buttons?: boolean[]` en `ControllerMessage` (`shared/src/index.ts:24-32`), validado en `controller-message.ts:13` | — | — | — |
| 3d | ¿El desktop los mapea a vJoy? | ✅ *(sin commit)* | `writeVJoyButtons` → `SetBtn` 1..8 (`vjoy-buttons.ts:3-10`); se liberan en el failsafe y al desconectar (`controller-session.ts:44-69`) | — | — | — |
| 3e | ¿Cuántos botones tiene el dispositivo vJoy? | 🟡 | La app no lo configura: lo hace el usuario en *Configure vJoy*. El companion **exige ≥ 8** (`requireVJoyButtons`, `vjoy-buttons.ts:11-14`, llamado en `vjoy-controller.ts:31`) y lee el número real con `GetVJDButtonNumber`, pero no lo publica. | Añadir el número al JSON de estado (útil para Advanced, 12b). **Ojo:** un usuario actual con menos de 8 botones verá `DEVICE_UNAVAILABLE` al actualizar. | S | Medio (regresión al actualizar) |
| 3f | ¿Dónde se configura momentáneo o toggle? | 🟡 | Constante fija en código: `controller-button.model.ts:3-6`. No hay UI ni persistencia. | Sección "Botones" de ajustes + persistencia (5a, 5f) | M | Bajo |
| 4a | Tarjeta central: Conectar / Conectando + Cancelar / Perdida + Reintentar | ✅ | `connection-panel` (`controller-page.component.html:18-35`): `connect()`, `disconnect()`, estado `error` | Reskin. "Reintentar" llama al mismo `connect()`. | S | Bajo |
| 4b | "Escanear QR" dentro de la PWA | ❌ | No hay código de cámara. `jsqr` solo es devDependency raíz para `scripts/test-package.mjs:9`. | `getUserMedia` + `BarcodeDetector` con fallback. Reutilizar `PairingService.parsePairingUrl` (`pairing.service.ts:5-11`), que ya valida el enlace. Ver D7. | M | Medio |
| 4c | "Conexión manual" en sección secundaria | ✅ | Formulario de endpoint manual (`controller-page.component.html:37-57`, `connection-address.ts`) | Moverlo a Ajustes → Conexión | S | Bajo |
| 4d | ¿Se detecta la pérdida de conexión? | 🟡 | Sí, por el evento `close` del socket (`controller-transport.service.ts:49-52`). Pero si el Wi-Fi cae sin cerrar TCP, el navegador puede tardar decenas de segundos en notarlo, porque no hay heartbeat de aplicación. No lo he medido en Android. | Con los `ack` de 1d: marcar "Conexión perdida" si no llega uno en ~2 s | S (sobre 1d) | Medio |
| 4e | ¿Reconexión automática? | ❌ | No existe (`docs/PAIRING.md`: "No hay … reconexión avanzada"). Tras reiniciar el companion el token cambia, así que reintentar con el endpoint guardado siempre falla, y el navegador no distingue un 401 de un error de red. | Reintento con backoff solo ante un cierre inesperado. Ver D4. | M | Medio (seguridad de vuelo) |
| 5a | Navegación lateral: Sticks, Botones, Conexión, Avanzado | ❌ | Solo existe un panel "Ajustes · Conexión avanzada" (`controller-page.component.html:37-57`) | Ruta o vista de ajustes con 4 secciones | M | Bajo |
| 5b | Zona muerta con slider | 🟡 | Existe **solo en el desktop** y es fija: `deadzone: .03` en `defaultConfig.calibration` (`desktop/src/config.ts:20-25`), aplicada en `ControllerMapper.mapAxis` (`controller-mapper.ts:30-32`). No se puede configurar ni por env ni por UI. | Decidir dónde se aplica (D2). Recomendado: en el teléfono y relativa a la del PC. | M | Medio (doble deadzone) |
| 5c | Inversión por eje | 🟡 | Solo en el desktop: `pitch.invert: true` por defecto (`config.ts:23`) | Igual que 5b. **Riesgo:** si el teléfono invierte el pitch y el PC también, se cancelan y el pitch queda al revés. | M | **Alto** si se hace mal |
| 5d | Calibración con fecha de la última | ⛔ | No hay flujo de calibración. La "calibración" del desktop es una constante (`config.ts:20-25`). En un stick táctil el centro y los extremos son geométricos (`stick-math.ts:22-28`), así que no hay nada que calibrar. | Sustituirla por otra cosa (ver D3 y §6) | — | — |
| 5e | Toggle "Valores en vivo" | 🟡 | `debugOpen` (`controller-page.component.ts:45`), no persistente | Persistirlo y mostrar las lecturas bajo los sticks | S | Bajo |
| 5f | Persistencia de ajustes | 🟡 | Solo `localStorage['fpv-controller-address']` (`controller-page.component.ts:67,73`, `pairing-flow.service.ts:40`) | Servicio `SettingsService` con un JSON versionado en `localStorage`. IndexedDB es innecesario para menos de 1 KB. | S | Bajo |
| 5g | Versión de la app | ✅ | `PRODUCT_VERSION`, generado por `scripts/generate-version.mjs` (hoy `0.4.0-beta.2`; el mockup muestra `beta.1` fijo) | Solo UI | S | Bajo |
| 6a | Fuentes Urbanist, Doto y Martian Mono autoalojadas | ❌ | Hoy se usa `system-ui` (`styles.css:2`). Los mockups cargan Google Fonts, que no funciona offline. | Añadir `.woff2` (subset latin) en `phone/public/fonts`, `@font-face` y `font-display: swap`. Cambiar el grupo `assets` de `ngsw-config.json:19-28` de `lazy` a `prefetch` (al menos para fuentes) para que funcionen offline desde la primera carga. Añadir `.woff2` al mapa MIME del servidor local (`static-phone.ts:4-5`). Las tres fuentes son OFL. | S | Bajo |
| 6b | `backdrop-filter` / `filter: blur()` en vuelo | 🟡 | No se usan hoy | Ver §6: en vuelo, sin `backdrop-filter` y con brillos sin `filter`. No lo he medido en Android de gama media. | S | Medio (jitter de envío) |
| 6c | Bloqueo de orientación landscape | ✅ | `screen.orientation.lock('landscape')` tras pasar a pantalla completa (`controller-page.component.ts:96-106`) + `"orientation": "landscape"` en el manifest | — | — | — |
| 6d | Fullscreen API | ✅ | `toggleFullscreen()` (`controller-page.component.ts:86-108`) | — | — | — |
| 6e | Wake Lock | ❌ | No hay código (búsqueda sin resultados) | `navigator.wakeLock.request('screen')` mientras haya conexión, con readquisición en `visibilitychange`. Soportado en Chrome Android 84+. | S | Bajo |
| 6f | `prefers-reduced-motion` | 🟡 | Solo en botones (`controller-page.component.css:56`) y en el spinner (`connect-page.component.ts:32`) | Aplicarlo a las animaciones nuevas (retorno del knob, brillos) | S | Bajo |

### Desktop

| # | Elemento | Estado | Dónde está hoy | Qué falta | Tamaño | Riesgo |
|---|---|---|---|---|---|---|
| 7a | Ventana 440 × 640 | 🟡 | `ClientSize = 590×820`, `MinimumSize 590×480` (`CompanionWindow.cs:69-70`) | Cambiar el tamaño y rehacer el layout (el contenido actual no cabe) | S | Bajo |
| 7b | Modo oscuro | ❌ | Tema claro fijo, `BackColor 245,248,250` (`:71`) | Todos los controles nativos (`Button`, `ComboBox`, `TextBox`) se ven claros; WinForms en .NET Framework no tiene modo oscuro. Hay que dibujarlos a mano (owner-draw) o usar WebView2 (D1). | L (WinForms) / incluido en D1 | Medio |
| 7c | Barra de título oscura | ❌ | Barra nativa por defecto | **Barata:** mantener la barra nativa y pintarla con `DwmSetWindowAttribute` (`DWMWA_USE_IMMERSIVE_DARK_MODE`=20, `DWMWA_CAPTION_COLOR`=35 → `#0D0D12`, `DWMWA_TEXT_COLOR`=36). Funciona en Windows 11, que es el mínimo del instalador. S. **Cara:** barra sin marco (`FormBorderStyle.None`) con `WM_NCHITTEST` para arrastrar, botones propios y recuperar la sombra o Snap Layouts. M-L y peor accesibilidad. | S (nativa) / M-L (sin marco) | Bajo / Medio |
| 7d | Vidrio y brillo con blur | ⛔ en WinForms tal cual / ✅ con WebView2 | — | WinForms no tiene blur ni transparencia real entre controles hermanos (`BackColor=Transparent` solo pinta el padre). Mica/Acrylic (`DWMWA_SYSTEMBACKDROP_TYPE`=38) exige un área cliente transparente que WinForms no ofrece sin hacks. Alternativa: **pre-renderizar** los brillos como PNG de fondo y dibujar las tarjetas con relleno semitransparente sobre esa imagen (el fondo es estático, así que el resultado es casi igual). Ver D1 y §6. | L (owner-draw) | Medio |
| 7e | Fuentes embebidas | 🟡 | `Segoe UI` (`:71`) | WinForms: `PrivateFontCollection` + `AddFontMemResourceEx`, porque las etiquetas usan `TextRenderer`/GDI, que no ve las fuentes privadas. Hacen falta TTF estáticos: Doto, Urbanist y Martian Mono son variables y GDI+ no maneja ejes. WebView2: `@font-face` local, trivial. | M (WinForms) / S (WebView2) | Medio |
| 7f | Restricción C# 5 | — | `csc.exe` v4.0.30319 (`build-desktop.mjs:32,42-45`) | Sin interpolación, sin `?.` ni miembros `=>`. Todo el código nuevo de UI es más verboso. Cambiar a Roslyn o MSBuild es posible pero añade toolchain. | — | Bajo (coste) |
| 8a | Tres chips: Controller, Server, Phone | 🟡 | Hoy hay 4 etiquetas de texto: `driver`, `websocket`, `network`, `phone` (`:86-90`) con texto "● Ready" | Componente chip (owner-draw o HTML) | S-M | Bajo |
| 8b | Estados de cada chip | ✅ (datos) | `virtualController`, `websocket`, `phone`, `issueCode` y `health` en el JSON de estado (`windows-entry.ts:28-33`) | Tabla de mapeo `issueCode` → chip. Controller: Ready / Driver needed (`DRIVER_MISSING\|MISMATCH`) / Not configured (`DEVICE_UNAVAILABLE`) / Busy (`DEVICE_BUSY`). Server: Ready / Port busy / No network / Paused. Phone: Waiting / Connected / Lost (`PHONE_LOST`) / Not reaching (`CONNECTION_HELP`). | S | Bajo |
| 8c | Quitar el chip "Network" | ✅ | La etiqueta `network` solo pinta `health.network` (`:209-212`). `NETWORK_MISSING` sigue llegando por `issueCode` (`windows-entry.ts:54-57`). | Nada se rompe en runtime. **Sí se rompe el `--self-test`**, que comprueba textos literales como `"Virtual Controller\n○ Driver required"` y `"● Ready"` (`CompanionWindow.cs:41,53`), y lo ejecuta `scripts/test-package.mjs`. Hay que reescribirlo. | S | Bajo |
| 9a | QR grande con brillo y barrido | 🟡 | PNG de 320 px con margen 4 generado en Node (`pairing-service.ts:10`) y mostrado en un `PictureBox` (`:91`) | Generar el QR sin margen (o como SVG con `QRCode.toString`, si se usa WebView2). Brillo pre-renderizado y barrido con `Timer` + `Invalidate` (WinForms) o CSS. | M | Bajo |
| 9b | Copiar link de conexión | ✅ | Botón `copy` → `pairingUrl` (`:126-127`) | Solo UI | S | Bajo |
| 9c | "New QR": ¿regenera el token? | ✅ | Sí. `Restart()` relanza el proceso Node, que genera `randomBytes(24)` nuevo (`windows-entry.ts:26`). Efecto secundario: también libera y readquiere vJoy y desconecta al teléfono. | Solo UI. "New QR" y "New pairing token" (12d) hacen **exactamente lo mismo**: hay que decidir si se deja uno solo. | S | Bajo |
| 10a | Paquetes por segundo en vivo | 🟡 | Se calcula (`ControllerMetrics.sampleRate`, `controller-metrics.ts:21-26`; `session.sampleMetrics`) pero solo va a una línea de log que `windows-entry.ts:40` **descarta**. No llega a la ventana. | Emitir un mensaje `{"type":"metrics","packetsPerSecond":…,"axes":…}` separado del `status`. Reenviar el `status` completo (con el QR en base64) cada segundo es caro, y `ApplyStatus` reconstruye el `ComboBox` de redes en cada línea (`:237-243`). | S-M | Bajo |
| 10b | Mini vista previa con ejes reales | ❌ (decorativa en el mockup) | `getReportedAxes()` ya da los ejes calibrados que van a vJoy (`companion.ts:29`) | Incluir `axes` en `metrics` a 10–20 Hz y dibujar dos círculos. Es factible y más útil que la animación. | M | Bajo |
| 10c | "Disconnect phone" | ❌ | El backend no tiene un comando para cerrar al cliente; stdin solo entiende `shutdown` (`windows-entry.ts:107-108`) | Comando `disconnect-phone` por stdin → `socket.close(4001, …)`. En el teléfono, el listener de `close` no lee el código (`controller-transport.service.ts:49`): sin eso se mostraría "Conexión perdida" (y reconectaría, si existe 4e). | S-M | Bajo |
| 10d | "Show QR" estando conectado | ✅ | `qrPngBase64` y `pairingUrl` siguen en el estado mientras el servidor escucha | Solo UI (un segundo teléfono sería rechazado: `maxPhoneClients=1`) | S | Bajo |
| 11a | vJoy no instalado: detección | ✅ | `VJoyController.connect` → `findDll`/`vJoyEnabled` (`vjoy-controller.ts:21-27,75-85`) → `userIssue` → `DRIVER_MISSING` (`user-errors.ts:10`) | — | — | — |
| 11b | "Download vJoy" (GitHub) | 🟡 | Abre `https://www.vjoy.org/download-for-windows` (`DesktopConfiguration.cs:5`) | Cambiar la URL a `github.com/BrunnerInnovation/vJoy/releases` | S | Bajo |
| 11c | "Check again" sin reiniciar la app | ✅ | `checkAgain` → `Restart()` (`:108`): reinicia solo el proceso Node, no la ventana, y koffi vuelve a cargar la DLL desde cero | Solo UI | S | Bajo |
| 11d | Puerto ocupado: detección | ✅ | `EADDRINUSE` → `PORT_BUSY` (`user-errors.ts:5`) | — | — | — |
| 11e | "Use another port" | ❌ | El puerto sale de `PORT` (env) con valor por defecto 8080 (`config.ts:37`); la ventana no lo pasa | La ventana elige un puerto libre (`TcpListener` en el puerto 0, o probar 8081..8099), lo pasa por `PORT` como ya hace con `FPV_BIND_ADDRESS` (`:185`) y lo **persiste** en `DataFolder`; si no, el siguiente arranque vuelve a 8080. El QR lleva el puerto, así que se regenera solo. | S-M | Bajo |
| 11f | Sin red local: detección | ✅ | `usefulAddresses()` vacío → `NETWORK_MISSING` (`windows-entry.ts:54-57`). Solo cuenta IPv4 privadas RFC1918 y excluye adaptadores virtuales (`local-network.ts:16`). | (Opcional) reintento automático con `NetworkChange.NetworkAddressChanged` | S | Bajo |
| 11g | "Open network settings" | ❌ | Botón inexistente | `Process.Start(new ProcessStartInfo("ms-settings:network") { UseShellExecute = true })` | S | Bajo |
| 11h | Firewall: detección | 🟡 | Solo un temporizador: 45 s sin teléfono → `CONNECTION_HELP` con un texto que menciona el firewall (`windows-entry.ts:95-99`). El servidor no ve los paquetes bloqueados. | Heurística realista en §4 (perfil de red Public, regla de bloqueo para `companion-engine.exe`, ningún intento de conexión). Siempre será "puede que sea el firewall", nunca una certeza. | M | **Alto** (falsos positivos y negativos) |
| 11i | Firewall: abrir configuración / añadir regla | 🟡 | Botón "Firewall" → `control firewall.cpl` (`:146`). El instalador es per-user y no puede añadir reglas; la política documentada es no tocarlas (`docs/DISTRIBUTION.md:76`). | Opción en D5: botón con elevación UAC que ejecute `netsh advfirewall firewall add rule … program=…\runtime\companion-engine.exe profile=private remoteip=localsubnet` | M | Medio (UAC, política) |
| 11j | Dispositivo vJoy no disponible u ocupado | ✅ (detección) | `DEVICE_UNAVAILABLE`, `DEVICE_BUSY` (`user-errors.ts:7-8`) | Reutilizar la plantilla de problema: "Open Configure vJoy" (ruta de `vJoyConf.exe` sin verificar) + "Check again" | S | Bajo |
| 11k | Fallo al iniciar el WebSocket | ✅ (detección) | `NETWORK_PERMISSION`, `STARTUP_FAILED`, `QR_FAILED`, `fatal` (`windows-entry.ts:81-93,112-115`) | Plantilla genérica + "Open logs" | S | Bajo |
| 11l | Pairing inválido (QR antiguo o token incorrecto) | 🟡 | El teléfono detecta el enlace mal formado (`connect-page.component.ts:14`). El PC **rechaza en silencio** en `verifyClient` (`controller-websocket-server.ts:36`), sin log ni estado. | Emitir `PAIRING_REJECTED` cuando `authorize` falla. Además, es la mejor señal para descartar el firewall (si llega un intento, el firewall no bloquea). | S | Bajo |
| 11m | Sin stack traces ni errores crudos en la UI | ✅ | `userIssue` traduce todo (`user-errors.ts`); el `fatal` también (`windows-entry.ts:114`); `stderr` → mensaje genérico (`CompanionWindow.cs:189`); los textos del teléfono son humanos. Test: `diagnostics.spec.ts:8-24`. | Mantenerlo: la UI nueva debe pintar textos según `issueCode`, no el `message` libre | — | Bajo |
| 12a | IP local, puerto, endpoint + copiar | ✅ (datos) | `addresses[].endpoint`, `port`, `selectedAddress` en el estado; `TextBox` de solo lectura (`:123-124`) | El mockup muestra `ws://IP:PORT` **sin token**, pero para conectar a mano se necesita el token (`authorizedConnection`). Mostrarlo enmascarado y copiar el endpoint completo. | S | Bajo |
| 12b | Estado del driver + descripción del dispositivo | 🟡 | `health.driver` existe. `deviceId` sale de la configuración; los 4 ejes se verifican pero no se publican; el número de botones se lee (`vjoy-native.ts:15`) pero no se publica. | Añadir `device: {id, axes, buttons}` al estado | S | Bajo |
| 12c | "Open logs folder" y logs a archivo | ✅ | Logs a archivo **sí existen**: `companion.jsonl` con rotación de 2 MB × 5 y tokens redactados (`structured-logger.ts`) y `window.jsonl` (`CompanionWindow.cs:169-176`). El botón existe (`:147-150`). | Solo UI | S | Bajo |
| 12d | "New pairing token" | ✅ | Igual que 9c (`Restart()`) | Ver 9c | S | Bajo |
| 12e | *(no en el mockup)* Selector de red del PC, Test joystick, Help, Local preview, onboarding | ⚠️ desaparecen | `addresses` ComboBox (`:117-122`), `joy.cpl` (`:140`), Help (`:145`), onboarding (`:77-85`) | El diseño los elimina. El selector de red es **necesario** (Wi-Fi frente a USB tethering). Para no quitar funcionalidad, reubicarlos en Advanced. | S | Medio (regresión funcional) |

## 4. Cambios fuera de la UI que exige el diseño

**Protocolo (shared + servidor + PWA)**
- **Mensajes PC → teléfono.** Hoy no existen. Propuesta compatible en ambos sentidos:
  - `{"type":"hello","protocol":2,"capabilities":["ack","close-codes"]}` al conectar.
  - `{"type":"ack","sequence":N}` cada ~500 ms, con el último `sequence` recibido. El teléfono guarda el instante de envío de cada `sequence` y calcula el RTT.
  - Los teléfonos antiguos no escuchan `message` y lo ignoran. Un teléfono nuevo con un companion antiguo no recibe `hello` y muestra "— ms".
  - Requiere añadir `message` a `TransportSocket` (`transport-runtime.ts`), el envío en `controller-websocket-server.ts` y tipos en `shared/src/index.ts`.
- **Mensajes teléfono → PC nuevos (p. ej. ajustes).** Evitarlos, o enviarlos solo si el `hello` anunció la capacidad, porque el servidor actual cierra con 1008 ante cualquier otro `type`.
- **Códigos de cierre.** Usar 4001 para "desconectado desde el PC" y 4003 para "token o origen rechazado" (este segundo solo es visible si el handshake se acepta y luego se cierra, ya que el navegador no expone el 401 del handshake). El teléfono debe leer `CloseEvent.code` para no confundirlos con "Conexión perdida" ni reconectar en esos casos.

**Servidor / backend Node (`desktop/src/distribution/windows-entry.ts`, `companion.ts`)**
- Mensaje `metrics` periódico (packets/s, ejes calibrados, edad del último paquete, failsafe), separado de `status`.
- Comandos por stdin además de `shutdown`: `disconnect-phone` (y quizá `regenerate`, para no relanzar el proceso entero y no soltar vJoy).
- Publicar `device: {id, axes:4, buttons:n}`.
- Evento `PAIRING_REJECTED` cuando `authorize` devuelve `false`, y `PHONE_ATTEMPTED` para distinguir "no llega nada" de "llega pero se rechaza".
- Exponer `startCompanion` con acceso a `server.clients` para cerrar al teléfono.

**Detección de errores (firewall, heurística realista)**
- Señales disponibles, de más fuerte a más débil:
  1. Existe una regla de **bloqueo** para `companion-engine.exe`. Se crea si el usuario pulsó "Cancelar" en el aviso de Windows Defender la primera vez; el aviso muestra "Node.js"/`companion-engine.exe`, no el nombre de la app, lo que favorece ese error. Se consulta con `netsh advfirewall firewall show rule name=all verbose` o la COM `HNetCfg.FwPolicy2` desde C#, sin necesidad de admin.
  2. El perfil de la red seleccionada es **Public** (`INetworkListManager` / `Get-NetConnectionProfile`).
  3. Han pasado 45 s sin intento de conexión (`PHONE_ATTEMPTED`) estando el servidor en `LISTENING`.
- Mostrar la pantalla "Firewall may be blocking it" solo con (1) o (2) más (3). Con solo (3) dejar el aviso genérico actual.
- Ninguna señal distingue el firewall del permiso **Local Network Access** de Chrome en el teléfono (`local-websocket.ts`). Es otra causa frecuente del mismo síntoma y conviene mencionarla en el texto.

**Persistencia**
- PWA: `localStorage` con una clave versionada (`fpv-settings-v1`): deadzone, inversión, modos y etiquetas de botones, valores en vivo.
- Desktop: puerto elegido y (si aplica) preferencias de UI en `%LOCALAPPDATA%\FPVPhoneController\` (ya existe `onboarding.hidden` como precedente, `CompanionWindow.cs:83`).

**Instalador y build**
- Fuentes TTF estáticas en `dist/windows` (WinForms) o en una carpeta `ui/` (WebView2), y sus licencias OFL en `licenses/`.
- WebView2 (si se elige): copiar `Microsoft.Web.WebView2.Core.dll`, `…WinForms.dll` y `WebView2Loader.dll`, y referenciarlos en `csc`. No lo he verificado con el `csc` C# 5 actual; WebView2 requiere .NET Framework 4.6.2+, que Windows 11 trae. El Runtime de WebView2 viene con Windows 11.
- Regla de firewall (si se elige D5): o bien un `[Run]` opcional con `Verb: runas` y `Flags: shellexec`, o bien un botón en la app con elevación. En ambos casos hace falta un `[UninstallRun]` que la borre.
- Reescribir `--self-test` (`CompanionWindow.cs:30-60`) y adaptar `scripts/test-package.mjs`.
- `ngsw-config.json`: fuentes en `prefetch`. `static-phone.ts`: MIME `font/woff2`.

## 5. Decisiones que necesito que tomes

**D1. Cómo se dibuja el desktop.**
- (a) WinForms owner-draw: un `UserControl` con doble buffer que pinta todo con GDI+, brillos en PNG pre-renderizado y barra de título nativa oscura. Sin cambio de arquitectura. Coste L (~6–9 días); fidelidad media-alta y animaciones a ~30 fps.
- (b) **WebView2 dentro de la ventana WinForms actual**: la UI pasa a HTML/CSS (los mockups son casi reutilizables) y C# reenvía las líneas JSON de estado con `PostWebMessageAsJson`. El backend y el protocolo no cambian. Coste L (~4–6 días, con empaquetado y self-test); fidelidad ~100 % y fuentes y blur triviales. Añade una dependencia y ~100 MB de RAM.
- (c) Electron, WPF o WinUI: reescritura completa del host y del toolchain. No compensa.
- **Recomendación: (b).** Es la opción más simple que conserva el diseño: no toca Node, vJoy ni el protocolo, y reutiliza la misma ventana y el mismo proceso. Si prefieres no añadir dependencias, (a) con las adaptaciones de §6.

**D2. Dónde viven la zona muerta y la inversión.**
- (a) **En el teléfono, relativas a lo que ya aplica el PC**: los toggles en "off" significan el comportamiento actual, incluido el pitch invertido del PC, y el slider es una zona muerta *adicional*. Sin cambios de protocolo ni riesgo con companions antiguos.
- (b) En el teléfono, sustituyendo las del PC (deadzone 0 e invert `false` en `config.ts`). Más limpio, pero un teléfono nuevo con un PC antiguo invierte el pitch dos veces.
- (c) Enviarlas al PC con un mensaje nuevo, negociado con `hello`. Correcto pero lo más caro.
- **Recomendación: (a).** Ojo: el mockup muestra PITCH "pulsado"; con (a) aparecería sin pulsar.

**D3. Tarjeta "Calibración".**
- (a) Eliminarla.
- (b) **Sustituirla por "Probar sticks"**: una vista con los valores enviados y un enlace para abrir `joy.cpl` desde el PC.
- (c) Implementar una calibración real (no tiene sentido físico en un stick táctil).
- **Recomendación: (b).**

**D4. Reconexión automática.**
- (a) Ninguna; solo "Reintentar".
- (b) **Automática ante un cierre inesperado**: backoff de 0,5/1/2/4 s durante ~30 s, botones siempre en OFF al reconectar (ya ocurre: `controller-transmission.service.ts:15`), y nunca si el cierre fue 4001/4003.
- (c) Automática e indefinida.
- **Recomendación: (b).** ARM vuelve a OFF, así que reconectar no rearma el dron.

**D5. Regla de firewall.**
- (a) No tocarla nunca (política actual); solo guía y un botón que abre `firewall.cpl`.
- (b) **Botón en la app "Allow on private networks"** que lanza `netsh` con UAC y una regla acotada (programa + Private + LocalSubnet, como ya prescribe `docs/DISTRIBUTION.md:76`).
- (c) Tarea opcional en el instalador (desmarcada por defecto).
- **Recomendación: (b)**, solo bajo demanda y cuando la heurística sospeche del firewall. Implica cambiar la política documentada.

**D6. Latencia en la píldora.**
- (a) **RTT con `ack` del PC** (§4).
- (b) Quitarla y mostrar solo los Hz.
- (c) Mostrar "edad del último ack" como indicador de salud sin ms.
- **Recomendación: (a)**, mostrando "—" si el companion es antiguo.

**D7. Escáner QR en la PWA.**
- (a) Solo `BarcodeDetector`: Chrome Android lo soporta y depende de Google Play Services; no existe en Safari iOS.
- (b) **`BarcodeDetector` con fallback `jsQR` cargado bajo demanda** (import dinámico; ya está en el monorepo).
- (c) Solo una librería (zxing-wasm o qr-scanner).
- **Recomendación: (b).** Requiere HTTPS: funciona en `fpv.brycofre.com`, pero **no** en el modo de preview local `http://192.168.x.x`, que no es contexto seguro.

**D8. Funciones que el diseño elimina** (selector de red del PC, Test joystick, Help, Local preview, onboarding) **y el duplicado New QR / New pairing token.**
- (a) **Reubicarlas en Advanced y dejar un solo "New QR"** (que ya renueva el token).
- (b) Eliminarlas.
- **Recomendación: (a).** El selector de red es imprescindible con USB tethering.

**D9. Botones 5..8 y su configuración.**
- (a) **"4 botones más" abre una hoja con los índices 4..7; etiquetas y modo se editan en Ajustes → Botones.**
- (b) Solo 4 botones visibles; quitar "4 botones más".
- **Recomendación: (a).**

## 6. Adaptaciones de diseño recomendadas

| Adaptación | Por qué | Qué se pierde visualmente |
|---|---|---|
| **PWA en vuelo sin `backdrop-filter`**: la píldora usa un fondo sólido `rgba(20,20,28,0.88)` | `backdrop-filter` obliga a recomponer la región en cada frame en el que cambia algo debajo. El envío a 60 Hz corre en el hilo principal (`setTimeout`, `controller-transmission-loop.ts`), así que cualquier frame lento añade jitter al control. No lo he medido en gama media; es un riesgo, no una certeza. | El efecto esmerilado de la píldora; sobre un fondo casi negro apenas se nota |
| **Brillos de fondo sin `filter: blur(70px)`**: degradados radiales más amplios (ya son suaves) o un WebP estático | Un elemento con blur del tamaño de la pantalla es caro de rasterizar y de mantener en memoria de GPU | Prácticamente nada: los degradados radiales con `transparent 70%` dan casi el mismo halo |
| **Knob con `transform: translate()`** en vez de `left/top`; sombra de 34 px reducida a ~20 px | Hoy cada `pointermove` provoca layout y paint (`virtual-stick.component.html:9`); con `transform` solo compone | Un halo algo menor alrededor del knob |
| **Tarjeta offline**: el blur de 24 px se mantiene (no hay vuelo); se desactiva con `prefers-reduced-transparency` o en gama baja | Coste aceptable fuera de vuelo | — |
| **Layout fluido en lugar de 900 × 416 en px** | Los teléfonos varían entre ~780 y ~915 px de ancho lógico en landscape | Proporciones exactas del mockup en algunos tamaños |
| **Calibración → "Probar sticks"** (D3) | No hay nada que calibrar en un stick táctil | La tarjeta con la fecha de calibración |
| **Firewall: un solo botón de acción** (D5) en vez de 3 pasos manuales | Menos fricción, regla acotada | La lista de pasos numerados (puede quedar como texto de ayuda) |
| **Mini sticks del desktop con ejes reales** (10b) | Más útil que una animación en bucle; confirma que vJoy recibe | La animación decorativa; si el teléfono está quieto, los sticks también |
| *Solo si D1 = WinForms*: **barra de título nativa oscura** (`DWMWA_CAPTION_COLOR`) | S frente a M-L; conserva Snap, sombra y accesibilidad | Altura y espaciado exactos de la barra de 40 px; los botones son los de Windows |
| *Solo si D1 = WinForms*: **vidrio = relleno semitransparente sobre brillo pre-renderizado**; barrido del QR y pulso a ~30 fps con `Timer` | WinForms no tiene blur ni transparencia entre hermanos | Ninguna diferencia perceptible: el fondo es estático, así que el blur real y el pre-renderizado dan casi el mismo resultado. Las animaciones serán algo menos fluidas. |
| **Chip "Paused"** de los mockups → "Not checked" o "Paused" según `health` | Ya existen esos estados en `health` | — |

## 7. Plan por fases (de menor a mayor riesgo)

| Fase | Contenido | Entregable | Tamaño estimado |
|---|---|---|---|
| **0. Preparación** | Commitear la funcionalidad de botones (hoy sin commit). Tokens CSS, fuentes autoalojadas (`.woff2`, ngsw `prefetch`, MIME). Decidir D1–D9. | Base estable; fuentes offline en la PWA actual | S–M |
| **1. Reskin PWA sin lógica nueva** | Header y píldora (4 estados + `error`), sticks con `transform` y retorno animado, lecturas por eje, barra vertical de throttle, botones con ARMED, tarjeta offline, Wake Lock, `prefers-reduced-motion`, adaptaciones de §6 | PWA con el nuevo look y el mismo protocolo; compatible con cualquier companion | M–L (3–4 días) |
| **2. Ajustes PWA** | Navegación de 4 secciones, `SettingsService` + `localStorage`, deadzone e inversión relativas (D2), "Probar sticks" (D3), toggle de valores en vivo, versión, Botones (modos y etiquetas) y hoja "4 botones más" (D9), conexión manual movida | Ajustes completos sin tocar el desktop | M–L (3 días) |
| **3. Backend del companion (sin UI nueva)** | Mensaje `metrics` (packets/s + ejes), `device` en el estado, `PAIRING_REJECTED` y `PHONE_ATTEMPTED`, comando `disconnect-phone`, puerto elegible y persistente por `PORT`, URL de vJoy a GitHub, `ms-settings:network` | La ventana actual puede seguir funcionando; los datos para el nuevo diseño ya están disponibles | M (2 días) |
| **4. Nueva UI desktop** | Según D1: WebView2 + HTML (b) u owner-draw (a). Chips, pairing con QR, conectado con mini sticks reales, pantallas de problema (vJoy, puerto, red, device, startup, pairing inválido), Advanced (con selector de red y extras de D8), barra de título oscura, self-test nuevo | Desktop rediseñado | L (4–6 días con b, 6–9 con a) |
| **5. Protocolo PC → teléfono** | `hello` + `ack` + códigos de cierre; latencia en la píldora; detección de pérdida por ausencia de `ack`; reconexión automática (D4) | Latencia real y pérdida rápida; compatible con versiones mixtas | M (2 días) |
| **6. Escáner QR en la PWA** | `getUserMedia` + `BarcodeDetector` + fallback `jsQR` (D7), reutilizando `parsePairingUrl` | Emparejar desde la PWA instalada sin salir de ella | M (1–2 días) |
| **7. Firewall** | Heurística (regla de bloqueo, perfil Public, ausencia de intentos), pantalla dedicada, botón con UAC y regla acotada (D5), limpieza al desinstalar, cambio de política en la documentación | Diagnóstico de firewall con acción | M–L (2–3 días); el más arriesgado (falsos positivos, UAC) |

**Total orientativo:** PWA ~9–12 días; desktop ~8–15 días según D1. En todas las fases hay que probar en un Android real de gama media y en un Windows 11 limpio; ni el rendimiento ni la heurística de firewall se pueden validar con los tests automáticos actuales.
