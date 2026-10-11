# Análisis de factibilidad — Rediseño UI de FPV Phone Controller

## Contexto

FPV Phone Controller convierte un teléfono en una emisora FPV virtual (Mode 2) para simuladores de PC (probado con Uncrashed y FPV SkyDive). Tiene dos partes:

- **PWA Angular** (`fpv.brycofre.com`): sticks táctiles en landscape que envían ejes por WebSocket.
- **Companion de Windows** (instalado con `setup.exe`): levanta el servidor WebSocket, genera un QR de pairing (host, puerto, token) y expone el teléfono como joystick a través de **vJoy** (BrunnerInnovation/vJoy).

Tengo un rediseño de UI de ambas apps. Antes de implementarlo quiero saber **qué se puede hacer con el código actual, qué falta y cuánto cuesta**.

## Tu tarea

**Solo analiza. No modifiques código, no instales dependencias, no hagas commits.** El único archivo que debes crear es el informe final.

1. Recorre el repositorio y explícame su estructura: dónde vive la PWA, dónde vive el desktop, con qué framework está hecho el desktop (WinForms, WPF, WinUI, Electron, etc.), cómo se comunican y cuál es el formato de los mensajes WebSocket.
2. Lee los mockups en `docs/design/` (ver "Cómo leer los mockups" abajo).
3. Contrasta **cada elemento** de la lista de abajo con el código actual.
4. Escribe el informe en `docs/ui-redesign-feasibility.md` con el formato indicado al final.

## Cómo leer los mockups

En `docs/design/` hay 7 archivos `.dc.html`. Son HTML con un sistema de plantillas propio:

- Los estilos inline tienen los valores exactos: colores, radios, tamaños, fuentes y espaciados.
- `{{variable}}` son valores dinámicos. `<sc-if>` y `<sc-for>` son condicionales y bucles.
- El `<script type="text/x-dc">` al final de cada archivo contiene la lógica de estados (por ejemplo, qué texto y color mostrar en cada estado de error). Úsalo para entender los estados, no como código a portar.
- `docs/design/README.md` resume los tokens de diseño.

| Archivo | Pantalla |
|---|---|
| `Main.dc.html` | PWA en vuelo (conectado), sticks y botones interactivos |
| `PhoneIdle.dc.html` | PWA sin conexión, con estados `idle`, `connecting` y `lost` |
| `PhoneSettings.dc.html` | PWA ajustes (sección Sticks) |
| `DeskWaiting.dc.html` | Desktop esperando teléfono (QR) |
| `DeskConnected.dc.html` | Desktop con teléfono conectado |
| `DeskDriver.dc.html` | Desktop con problema: `vjoy`, `port`, `network`, `firewall` |
| `DeskAdvanced.dc.html` | Desktop con la sección Advanced abierta |

## Elementos a verificar

### PWA

1. **Header**
   - Logo, chip "MODE 2".
   - Píldora de estado con 4 estados: sin conexión, conectando, conectado, conexión perdida.
   - Frecuencia de envío en Hz y latencia en ms. ¿Se mide hoy la latencia? ¿Existe ping/pong o algo equivalente?
   - Botón Desconectar dentro de la píldora.
   - Botones de icono: valores en vivo (debug), ajustes y pantalla completa.
2. **Sticks**
   - Arrastre con pointer events y pointer capture.
   - **Multitouch real:** los dos pulgares a la vez sin interferencia.
   - Retorno al centro animado para yaw, roll y pitch. El throttle mantiene su posición.
   - Lecturas numéricas de cada eje.
   - Barra vertical de throttle y porcentaje grande.
3. **Botones virtuales**
   - ARM (toggle, estado ARMED en rojo), RESET (momentáneo), AUX 1 y AUX 2 (toggle).
   - Acceso a hasta 8 botones ("4 botones más").
   - ¿El protocolo WebSocket ya transporta botones? ¿El desktop ya los mapea a botones de vJoy? ¿Cuántos botones tiene configurado el dispositivo vJoy?
   - ¿Dónde se configura si un botón es momentáneo o toggle?
4. **Estado sin conexión**
   - Tarjeta central con CTA "Conectar" y estados conectando (con Cancelar) y conexión perdida (con Reintentar).
   - Botón "Escanear QR" **dentro de la PWA**: requiere cámara. Evalúa `BarcodeDetector` frente a una librería, y el soporte en Android Chrome.
   - "Conexión manual" movida a una sección secundaria.
   - ¿Se detecta hoy la pérdida de conexión? ¿Hay reconexión automática?
5. **Ajustes**
   - Navegación lateral: Sticks, Botones, Conexión, Avanzado.
   - Zona muerta con slider, inversión por eje, calibración con fecha de la última, toggle de valores en vivo.
   - Persistencia de ajustes (¿localStorage, IndexedDB, otro?).
   - Mostrar la versión de la app.
6. **Transversal**
   - Fuentes Urbanist, Doto y Martian Mono **autoalojadas** para que funcionen offline en la PWA.
   - Coste de `backdrop-filter` y `filter: blur()` en Android de gama media mientras se vuela. Indica si conviene una alternativa sin blur.
   - Bloqueo de orientación landscape, Fullscreen API, Wake Lock y `prefers-reduced-motion`.

### Desktop

7. **Ventana**
   - Tamaño compacto (440 × 640), modo oscuro.
   - Barra de título personalizada oscura (ventana sin marco o barra integrada). Dime cuánto cuesta esto con el framework actual.
   - Efectos de vidrio y brillo con blur. ¿Se pueden lograr con este framework (Mica/Acrylic, render propio, etc.) o hay que simplificarlos?
   - Fuentes personalizadas embebidas.
8. **Estados del sistema**
   - Tres chips: Controller, Server, Phone, cada uno con sus estados (Ready, Waiting, Connected, Driver needed, Port busy, etc.).
   - Nota: el diseño ya no muestra "Network" como chip; lo convierte en estado de error. Confirma que eso no rompe nada.
9. **Pairing**
   - QR grande con brillo y animación de barrido.
   - Copiar link de conexión.
   - "New QR": ¿regenera también el token?
10. **Conectado**
    - Paquetes por segundo en vivo. ¿Ya se calcula?
    - Mini vista previa de los sticks. Evalúa si puede reflejar los ejes reales en lugar de ser decorativa.
    - "Disconnect phone": ¿el servidor puede cerrar la sesión del teléfono?
    - "Show QR" estando conectado.
11. **Pantallas de problema.** Para cada una: ¿se detecta hoy? ¿Cómo? ¿Qué haría falta?
    - vJoy no instalado: "Download vJoy" (abre GitHub) y "Check again" (vuelve a comprobar sin reiniciar la app).
    - Puerto ocupado: "Use another port" (elegir un puerto libre automáticamente y regenerar el QR).
    - Sin red local: "Open network settings" (`ms-settings:network`).
    - Firewall: detectar que el teléfono no llega. Evalúa qué heurística es realista y si se puede abrir la configuración del firewall o añadir la regla desde el instalador.
    - También: dispositivo vJoy no disponible, fallo al iniciar el WebSocket y pairing inválido, aunque no tengan pantalla propia en los mockups.
    - Requisito: ningún stack trace ni error crudo en la UI.
12. **Advanced**
    - IP local, puerto, endpoint con botón copiar.
    - Estado del driver vJoy y descripción del dispositivo (número, ejes, botones).
    - "Open logs folder". ¿Existen logs a archivo hoy?
    - "New pairing token".

## Restricción

No se cambian funcionalidades ni arquitectura técnica salvo que sea **imprescindible** para un elemento del diseño. Si algo del mockup requiere un cambio de arquitectura (por ejemplo, cambiar de framework en el desktop o cambiar el protocolo), señálalo claramente como decisión mía y propone la alternativa más simple que mantenga el diseño.

## Formato del informe (`docs/ui-redesign-feasibility.md`)

1. **Resumen** (5–8 líneas): qué tan lejos está el código del diseño y cuáles son los 3 mayores bloqueos o riesgos.
2. **Mapa del repositorio:** carpetas clave, frameworks y versiones, y el formato actual del mensaje WebSocket con un ejemplo.
3. **Tabla de factibilidad**, una fila por elemento numerado de arriba (subdivide cuando haga falta):

   | # | Elemento | Estado | Dónde está hoy | Qué falta | Tamaño | Riesgo |
   |---|---|---|---|---|---|---|

   - Estado: ✅ ya existe (solo cambia la UI) · 🟡 parcial · ❌ falta lógica nueva · ⛔ no factible tal como está diseñado.
   - Tamaño: S (menos de medio día) · M (1–2 días) · L (más de 2 días).
   - "Dónde está hoy" con rutas de archivo reales.
4. **Cambios fuera de la UI** que el diseño exige: protocolo, servidor, detección de errores, persistencia, instalador.
5. **Decisiones que necesito tomar**, cada una con 2–3 opciones y tu recomendación.
6. **Adaptaciones del diseño** que recomiendas si algo es caro o arriesgado (por ejemplo, quitar el blur en el teléfono), explicando qué se pierde visualmente.
7. **Plan por fases** para implementar, de menor riesgo a mayor, con lo que se puede entregar en cada fase.

Sé concreto: cita archivos y funciones reales. Si algo no lo puedes confirmar leyendo el código, dilo en vez de suponerlo.

Cuando termines, avísame con un resumen corto y el enlace al informe.
