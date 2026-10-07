# Desktop companion: vJoy

La tercera etapa convierte ControllerState en cuatro ejes de un joystick virtual de Windows. No implementa botones, ARM, AUX, expo, rates, vibración ni perfiles. La siguiente comprobación es joy.cpl; todavía no pasar a simuladores.

## Elección del driver

Se usa vJoy 2.2.2.0 firmado del fork de BRUNNER para Windows 10/11 x64. Es práctico para alimentar un joystick multieje directamente desde Node a través de su SDK C. Su mantenimiento es limitado: BRUNNER lo declara explícitamente. No es una promesa de mantenimiento activo continuado.

HIDMaestro es una alternativa más activa con SDK C#/.NET 10 y perfiles HID. Adoptarlo ahora añadiría runtime .NET y un bridge fuera de Node. ViGEmBus está retirado; no se ha elegido como nueva dependencia. La abstracción VirtualController permite reemplazar vJoy después sin cambiar WebSocket o el mapping.

Fuentes comprobadas:
- [Release firmado vJoy 2.2.2.0](https://github.com/BrunnerInnovation/vJoy/releases/tag/v2.2.2.0)
- [Declaración de mantenimiento de BRUNNER](https://github.com/BrunnerInnovation/vJoy#brunner-disclaimer)
- [HIDMaestro](https://hidmaestro.org/)
- [Fin de vida de ViGEmBus](https://docs.nefarius.at/projects/ViGEm/End-of-Life/)
- [SDK C vJoy](https://github.com/BrunnerInnovation/vJoy/blob/master/SDK/inc/vjoyinterface.h)
- [Koffi](https://koffi.dev/)

## Dependencias externas

- Windows 11 x64 y Node.js x64 compatible con el proyecto.
- Driver firmado vJoy 2.2.2.0 instalado manualmente.
- vJoyInterface.dll x64 del SDK de esa misma versión.
- Dependencias npm: ws y Koffi. Koffi está incorporado en package.json y package-lock.json, con binarios precompilados. No se requieren herramientas C++ para la instalación npm normal.

Ni el proyecto ni sus tests ejecutan instaladores, cambian firmas de Windows o configuran dispositivos automáticamente.

## Instalar y configurar vJoy

1. Abre la release de BRUNNER enlazada arriba y descarga el instalador firmado, desde sus Assets.
2. Ejecuta el instalador manualmente con la elevación que solicite Windows. Instala también las herramientas de configuración.
3. Reinicia si el instalador lo requiere.
4. Abre **Configure vJoy / vJoyConf** y selecciona **Device 1**.
5. Habilita el dispositivo y sus ejes **X, Y, Z y Slider** (primer slider, HID 0x36). Aplica la configuración. Este companion exige esos cuatro ejes; no cambia automáticamente a Rx.
6. Los botones/POVs que puedan aparecer no son utilizados por el companion. No configures FFB para esta etapa.
7. Asegura que otra aplicación feeder no tenga adquirido Device 1.
8. Si la DLL no está en la instalación habitual, extrae el SDK de la misma release y localiza su DLL x64. Define su ruta absoluta:

```powershell
$env:VJOY_DLL_PATH = 'C:\ruta\al\SDK\x64\vJoyInterface.dll'
```

La búsqueda automática usa Program Files/vJoy/x64, Program Files/vJoy/SDK/x64 y Program Files/vJoy. No carga una DLL arbitraria desde la carpeta de trabajo. DriverMatch verifica compatibilidad entre DLL y driver.

Si Windows rechaza la instalación o el driver, conserva el error para diagnóstico y revisa la release. No uses paquetes antiguos sin firma ni cambies opciones de seguridad para esta prueba.

## Levantar el companion y el teléfono

Desde la raíz:

```powershell
npm install
npm run desktop
```

En otra terminal:

```powershell
npm run phone
```

Si el companion anterior está abierto, detén esa instancia con Ctrl+C antes de reiniciar. Ahora el companion necesita vJoy preparado antes de abrir el puerto.

El arranque debe mostrar:

```text
Virtual controller: vjoy device 1 ready
WebSocket: listening on :8080
```

Abre http://IP_DEL_PC:4200 en el teléfono; conecta a ws://IP_DEL_PC:8080. La IP se obtiene con ipconfig en la interfaz Wi-Fi o USB tethering, como explica el README raíz.

## Verificar primero con joy.cpl

1. Presiona **Win+R**, escribe **joy.cpl** y pulsa Enter.
2. Debe aparecer **vJoy Device**. Si no aparece, la instalación/configuración todavía no está verificada.
3. Selecciona el dispositivo → **Propiedades** → pestaña **Test / Probar**.
4. Inicia el companion y conecta el teléfono.
5. Mueve un eje a la vez y comprueba:

| Control del teléfono | Eje Windows | Recorrido esperado |
| --- | --- | --- |
| Roll | X | −1 mínimo; 0 centro; +1 máximo |
| Pitch | Y | Teléfono +1 arriba → mínimo; 0 centro; −1 abajo → máximo |
| Yaw | Z | −1 mínimo; 0 centro; +1 máximo |
| Throttle | Slider | 0 mínimo; 0.5 mitad; 1 máximo |

Windows puede mostrar X/Y como una cruz y los otros ejes como barras. Pitch se invierte en el mapper porque en el teléfono positivo significa arriba y en joy.cpl aumentar Y mueve la cruz abajo. Roll no se invierte. La cruz debe seguir la posición del stick derecho.

Yaw neutro corresponde a la mitad de la barra Z Axis, no a una barra vacía. Throttle máximo corresponde a Slider lleno. X/Y no muestran throttle ni yaw.

6. Suelta: roll/pitch/yaw deben autocentrar y throttle mantener su valor mientras siguen llegando paquetes.
7. Pulsa Disconnect: throttle debe ir al mínimo y los otros ejes al centro.
8. Reconecta, eleva throttle y corta temporalmente la conexión de red o cierra la app. En aproximadamente 250 ms desde el último paquete válido, debe activarse failsafe y verse el estado seguro.
9. Cierra el companion con Ctrl+C: debe resetear y liberar el dispositivo.

**Después de confirmar los cuatro ejes en joy.cpl, sigue [la guía de primera prueba en Uncrashed](../docs/UNCRASHED.md).**

## Configuración central

desktop/src/config.ts centraliza puerto, host, timers, driver, device ID y mapper:

```typescript
controller: { driver: 'vjoy', deviceId: 1, failsafeMs: 250 }
```

Overrides opcionales en la misma terminal:

```powershell
$env:PORT = '8080'
$env:VJOY_DEVICE_ID = '1'
$env:FAILSAFE_MS = '250'
npm run desktop
```

La configuración por eje está en defaultConfig.calibration: min, max, center, invert y deadzone en unidades lógicas de entrada. Pitch conserva inversión true para la dirección verificada en joy.cpl; throttle, yaw y roll tienen false. La deadzone inicial es 0.03 en yaw/pitch/roll y no se aplica al throttle. Los extremos asimétricos se normalizan a cada lado del centro y la deadzone reescala hasta -1 y 1. No hay expo/rates ni UI de configuración.

Activa el monitor RAW/CALIBRATED con `$env:CONTROLLER_DEBUG = '1'` antes de `npm run desktop` desde la raíz. Las métricas se imprimen aproximadamente una vez por segundo: packets/s, updates/s, LOST, SEQ y AGE. AGE es tiempo local desde recepción, no latencia de red. El failsafe anuncia FAILSAFE ACTIVE y escribe ejes seguros directamente.

## Arquitectura

```text
src/
├── config.ts
├── server.ts
├── companion.ts
├── controller/
│   ├── virtual-controller.ts
│   ├── virtual-controller.types.ts
│   ├── controller-mapper.ts
│   ├── controller-session.ts
│   └── fake-virtual-controller.ts
├── drivers/vjoy/
│   ├── vjoy-controller.ts
│   └── vjoy-native.ts
├── models/controller-message.ts
└── websocket/
    ├── controller-websocket-server.ts
    └── controller-metrics.ts
```

- VirtualController define conectar, actualizar ejes lógicos, resetear y liberar.
- ControllerMapper limita e invierte ejes y aplica deadzone sin conocer el driver ni sus rangos.
- ControllerSession aplica cada estado inmediatamente y mantiene un único temporizador de failsafe. No añade otro loop de 60 Hz.
- VJoyController valida y adquiere Device ID, consulta rangos, convierte valores y escribe ejes. Detalles ABI/FFI están aislados en vjoy-native.
- WebSocket valida JSON, sequence y ranges; solo entrega nuevos estados a un callback, sin importar vJoy.
- companion conecta estas piezas y coordina startup/shutdown. server compone el driver y registra SIGINT/SIGTERM.

Solo se admite un teléfono activo. Los estados inválidos, duplicados o atrasados no refrescan el failsafe. El temporizador usa performance.now y reajusta un único plazo; no acumula estados. Si deja de llegar información, el estado seguro es throttle=0 y yaw/pitch/roll=0. Reset ignora inversión/deadzone para que una inversión de throttle no convierta un failsafe en potencia máxima.

Al recuperarse paquetes válidos, se aplica el nuevo estado inmediatamente. No se ha añadido rearmado ni reconexión avanzada.

Cada estado escribe cuatro SetAxis sucesivos; no es un reporte atómico. Si un eje falla, se intentan los demás y se inicia un apagado con error. En shutdown se detiene la sesión, se intenta reset, se libera el dispositivo y se cierra WebSocket; la limpieza sigue aunque reset falle.

El failsafe depende del event loop del companion y de un driver operativo. SIGINT/SIGTERM usan cierre ordenado; una terminación forzada del proceso no garantiza que alcance a resetear ejes. Esto todavía es un controlador para simulación.

## Logs y tests

No se imprime cada paquete. Cada segundo se muestra el estado aplicado después del mapper/failsafe, junto a métricas de recepción. AGE se refiere al último paquete, no a latencia de red ni a una actualización física del driver.

```powershell
npm test
npm run build
```

Los tests cubren extremos y mitad de throttle, clamp, inversión, deadzone, falla por silencio/desconexión, temporizador único, recuperación, shutdown y entrega WebSocket a FakeVirtualController. No se ejecuta el driver Windows en unit tests.

El test manual pendiente es joy.cpl con los cuatro ejes y el failsafe.
