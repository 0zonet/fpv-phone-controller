# Frontend FPV Mode 2

Desde la raíz del proyecto: `npm run phone`. Abre `http://IP_DEL_PC:4200` en el celular conectado a la misma Wi-Fi. Gira el celular y pulsa **Pantalla completa**; fullscreen requiere una acción del usuario y bloquear orientación depende del navegador.

La app transmite ControllerState al companion por WebSocket a aproximadamente 60 Hz. El frontend no accede a vJoy: el companion Windows convierte los datos al joystick virtual. Introduce `ws://IP_DEL_PC:8080` y pulsa Connect; Disconnect detiene el transporte. La URL inicial usa el host de la página, y la última dirección se guarda en localStorage. Las instrucciones de USB tethering están en el README raíz; la instalación del driver y la prueba joy.cpl están en desktop/README.md.

## Arquitectura

```text
src/app/
├── app.component.ts
├── app.routes.ts
├── core/
│   ├── models/
│   │   ├── axis-value.model.ts
│   │   ├── stick-state.model.ts
│   │   └── controller-state.model.ts
│   └── services/
│       ├── controller-state.service.ts
│       ├── controller-state.service.spec.ts
│       ├── controller-transport.service.ts
│       ├── controller-transport.service.spec.ts
│       ├── controller-transmission.service.ts
│       ├── controller-transmission-loop.ts
│       ├── controller-transmission-loop.spec.ts
│       ├── transport-runtime.ts
│       └── transport-test-runtime.ts
└── features/controller/
    ├── pages/controller-page/
    │   └── controller-page.component.{ts,html,css}
    ├── components/
    │   ├── virtual-stick/virtual-stick.component.{ts,html,css}
    │   ├── controller-debug/controller-debug.component.{ts,html,css}
    │   └── connection-status/connection-status.component.ts
    └── utils/
        ├── stick-math.ts
        └── stick-math.spec.ts
```

- AppComponent solo aloja RouterOutlet; app.routes carga la página bajo demanda.
- ControllerPage compone la pantalla y coordina inputs/outputs con ControllerStateService. Los botones delegan la conexión al transporte; no calcula geometría ni contiene WebSocket. La acción de fullscreen es una responsabilidad de presentación.
- ControllerStateService es la fuente única de verdad. Publica computed readonly, métodos setLeftStick/setRightStick y reset. No expone signals mutables. El estado contiene throttle 0–1 y yaw/pitch/roll −1–1.
- ControllerTransportService transporta el estado sin modificarlo y expone signals readonly de conexión y error. ControllerTransmissionService conecta el estado con un único loop a 60 Hz. El loop usa setTimeout reprogramado y performance.now; no depende de pointermove ni del refresco de pantalla. transport-runtime proporciona reloj y fábrica WebSocket inyectables para tests.
- VirtualStick es controlado por inputs, no conoce FPV ni inyecta el servicio. Gestiona captura de pointers, teclado, cancelación, foco y visibilidad mediante eventos Angular. Mantiene únicamente estado temporal del gesto.
- ControllerDebug formatea mediante computed los cuatro valores debajo de los sticks.
- ConnectionStatus presenta CONNECTED, CONNECTING, DISCONNECTED o ERROR, sin lógica de conexión.
- stick-math contiene geometría pura y políticas de autocentrado, sin dependencia de Angular.

Todos los componentes son standalone y OnPush. Templates y CSS están encapsulados; el CSS global contiene solamente la base visual.

La caché persistente de Angular está desactivada en angular.json: en este entorno de Windows provocaba que el build terminara sin diagnóstico. El build funciona con la caché desactivada.

## API del stick

| Input | Inicial | Significado |
| --- | --- | --- |
| xValue | 0 | Valor controlado X |
| yValue | 0 | Valor controlado Y |
| xReturnToCenter | true | X vuelve a 0 al soltar |
| yReturnToCenter | true | Y vuelve a 0 al soltar |
| invertY | true | Y positivo apunta hacia arriba |
| label | Stick virtual | Etiqueta accesible |

`valueChange` emite `{ x, y }`, normalizado entre −1 y 1 y limitado al círculo unitario. El consumidor actualiza los inputs al recibir el evento. No hay actualización duplicada de estado dentro del stick.

Cada instancia captura un pointer independiente. Un dedo en cada stick puede mover ambos simultáneamente. Los eventos de otro dedo sobre una instancia activa se ignoran. Pointerup, pointercancel, pérdida de captura, pérdida de foco y ocultar la página finalizan el gesto con la misma política de retorno. Las flechas permiten interacción con teclado; al soltarlas se aplica el autocentrado configurado.

La limitación circular mantiene la dirección: una diagonal no puede tener simultáneamente X=1 e Y=1. En el izquierdo, yaw está limitado cerca de los extremos de throttle por esa geometría circular, conforme al recorrido solicitado.

## Mapeo Mode 2

El servicio traduce `throttle = (Y + 1) / 2` y `Y = throttle * 2 - 1`. Throttle empieza en 0 (stick abajo), conserva su valor al soltar y yaw vuelve a 0. El derecho autocentra roll y pitch. No se convierte throttle en el template.

## Validación

```powershell
npm run test:phone
npm --prefix phone run build
node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p phone/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p phone/tsconfig.spec.json
```

Los tests ejecutan funciones puras y el servicio Angular real con Signals; no usan mocks de Angular. Cubren límites, coordenadas, inversión Y, círculo, porcentajes visuales, retorno, persistencia, mapeo de throttle, mutaciones, reset y entradas no finitas. La comprobación física de multitouch y fullscreen requiere un celular.

También cubren el transporte Angular real con sockets y reloj simulados: sequence, mensajes JSON, no envío con sockets cerrados, backpressure, errores, timeout, conexiones sucesivas y loop único. La transmisión se detiene al desconectar o salir de la página. No hay reconexión automática ni vJoy.
