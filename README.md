# fpv-phone-controller

Monorepo con Angular 20 standalone en `phone`, companion Node.js/TypeScript en `desktop` y protocolo compartido en `shared`. Las dependencias se instalan desde la raíz. El companion ahora alimenta un joystick virtual vJoy de cuatro ejes.

Para usuarios finales: [USER_README.md](USER_README.md). Para empaquetar, publicar en Vercel y probar un Windows sin Node: [Distribución](docs/DISTRIBUTION.md).

El companion distribuible muestra un QR que abre /connect en la PWA pública y conecta automáticamente usando IP, puerto y clave temporal. Protocolo, pruebas y pasos de publicación: [Pairing QR](docs/PAIRING.md). El servidor de desarrollo en consola mantiene la conexión manual.

En Windows x64 con Node 24: `npm run build:desktop` genera la app nativa con runtime incluido; `npm run package:windows` genera `dist/FPVPhoneControllerSetup.exe`. `npm run test:package` verifica el paquete aislado con un driver fake. El dominio de distribución se configura en `distribution.config.json`, actualmente https://fpv.brycofre.com; PWA_URL permite sobrescribirlo al compilar.

Antes de ejecutar desktop, instala y configura manualmente el driver firmado vJoy 2.2.2.0 y su SDK x64. Sigue [la guía de instalación y verificación en joy.cpl](desktop/README.md). Después de verificar los cuatro ejes en Windows, sigue [la guía de calibración y primera prueba en Uncrashed](docs/UNCRASHED.md).

## Levantar ambos proyectos

Requiere Node.js compatible con Angular 20 (20.19+, 22.12+ o 24) y npm. Desde esta carpeta:

```powershell
npm install
npm run desktop
```

En otra terminal, desde la misma carpeta:

```powershell
npm run phone
```

Desktop escucha WebSocket en `0.0.0.0:8080`. Angular escucha HTTP en `0.0.0.0:4200`. El servidor imprime las direcciones IPv4 del PC.

Si hay una versión anterior del companion abierta, detenla con Ctrl+C en su terminal y vuelve a iniciarla: cambió el formato del protocolo. Si 4200 está ocupado por otro proyecto, detenlo o usa `npm --prefix phone run start -- --port 4201` y abre ese puerto desde el teléfono. Para cambiar el puerto del companion:

```powershell
$env:PORT = '8081'
npm run desktop
```

En ese caso introduce `ws://IP_DEL_PC:8081` en la app.

## Celular conectado por USB tethering

1. Conecta el teléfono al PC por USB y activa **Compartir Internet por USB / USB tethering** en el teléfono.
2. En PowerShell del PC ejecuta `ipconfig`.
3. Busca el adaptador Ethernet de tethering: suele mencionar USB, RNDIS, Remote NDIS o el nombre del teléfono. Si hay varios, compara antes y después de activar tethering.
4. Copia la **Dirección IPv4 del PC** de ese adaptador. No uses la puerta de enlace, que normalmente corresponde al teléfono.
5. Desde el navegador del teléfono abre `http://IP_DEL_PC:4200`.
6. La app propone `ws://IP_DEL_PC:8080` usando el host de la página. Revisa la dirección y pulsa **Connect**.
7. Debe aparecer **CONNECTED**. Mueve los sticks y observa la consola del companion.

Otra forma de listar adaptadores e IPv4:

```powershell
Get-NetIPConfiguration | Select-Object InterfaceAlias, InterfaceDescription, IPv4Address
```

La IP cambia según teléfono, red y adaptador; no está hardcodeada. La última URL de WebSocket se guarda en localStorage al conectar. Si cambió la IP, edita el campo.

Si no abre la web o no conecta: comprueba ambas terminales, la IP del adaptador USB y las reglas del Firewall de Windows para Node.js/TCP 4200 y 8080. Algunos teléfonos o redes de tethering restringen tráfico local; también puedes probar ambos dispositivos en la misma Wi-Fi. El servidor HTTP de desarrollo debe estar accesible desde el teléfono.

Usa HTTP y ws en esta prueba local. Si sirves la web por HTTPS necesitarás un endpoint wss con TLS, aún no configurado. **Pantalla completa** requiere pulsar el botón; bloquear orientación depende del navegador.

## Flujo y arquitectura

`Pointer Events → ControllerStateService → ControllerTransmissionService → ControllerTransportService → WebSocket → companion`

- ControllerStateService conserva el mando Mode 2: throttle 0–1, yaw/pitch/roll −1–1.
- ControllerTransmissionService coordina un único loop, activo solo con conexión establecida.
- ControllerTransmissionLoop usa setTimeout reprogramado a 60 Hz y performance.now para sus plazos. Lee el último estado en cada tick, nunca transmite por pointermove y no recupera ticks atrasados con ráfagas.
- ControllerTransportService solo abre/cierra/envía por WebSocket nativo; no modifica el estado del mando. Expone status/errorMessage readonly.
- ConnectionStatusComponent presenta CONNECTED, CONNECTING, DISCONNECTED o ERROR. La página solo coordina UI, servicio de estado y transporte.
- Desktop separa arranque, recepción, validación y métricas por cliente.
- Desktop entrega cada estado válido a ControllerMapper y VirtualController sin un nuevo loop. El driver vJoy convierte los rangos y el failsafe resetea los ejes tras 250 ms de silencio o al desconectar. Solo admite un teléfono activo.

El protocolo está tipado en shared. JSON:

```json
{
  "type": "controller-state",
  "sequence": 123,
  "timestamp": 1700000000000,
  "axes": { "throttle": 0.5, "yaw": -0.2, "pitch": 0.1, "roll": 0.8 }
}
```

Sequence empieza en 0 por conexión y aumenta después de cada envío exitoso. Timestamp es Date.now en milisegundos Unix. Se omite el envío si el socket no está OPEN o si la cola de salida supera 4 KiB; no se acumulan estados antiguos en una cola propia. 60 Hz es un objetivo aproximado, no una garantía de tiempo real del navegador. Suspender la app puede reducir o detener temporalmente los timers.

## Consola y desconexiones

Una actualización por segundo, por cliente:

Los ejes corresponden al estado aplicado después del mapper/failsafe. Las métricas describen recepción, por lo que AGE puede aumentar aunque los ejes ya estén reseteados.

```text
Client connected: 192.168.x.x
THR 0.42 | YAW -0.14 | PIT 0.72 | ROL 0.05 | 60 packets/s | SEQ 123 | LOST 0 | AGE 12 ms
```

- packets/s usa el tiempo real transcurrido en la ventana.
- SEQ es el último sequence aceptado.
- LOST acumula huecos de sequence desde 0 por conexión. WebSocket/TCP entrega ordenadamente; este contador no mide directamente pérdidas de paquetes de la red.
- AGE es tiempo desde la última recepción, medido con performance.now del PC; no es latencia entre PC y teléfono.
- Timestamp del emisor y receivedAt local permiten añadir medición de latencia más adelante; restar relojes sin sincronización no daría una latencia fiable.

El servidor valida type, axes, valores finitos, rangos, sequence entero seguro no negativo y timestamp numérico finito no negativo. Limita mensajes a 2 KiB y rechaza JSON inválido o mensajes binarios. Mensajes duplicados o con sequence menor no reemplazan el último estado.

El cierre normal y los errores liberan recursos. La conexión inicial tiene timeout de 8 segundos. El companion usa ping/pong cada 10 segundos para limpiar clientes sin respuesta, aproximadamente en 10–20 segundos; el joystick tiene un failsafe independiente y más corto, de 250 ms sin paquetes válidos. El navegador responde a estos pings automáticamente. Tras cerrar/reiniciar servidor, pulsa **Connect** de nuevo: no hay reconexión automática. Disconnect no modifica los sticks del teléfono, pero pone el dispositivo Windows en estado seguro.

## Verificación

```powershell
npm --prefix phone run build
npm run test:phone
npm --prefix desktop run build
npm --prefix desktop test
```

Los tests cubren geometría, estado, transporte real de Angular con sockets simulados, sequence, sockets cerrados, backpressure, errores, timeout, loop único a 60 Hz, validación, métricas y servidor WebSocket real. No requieren hardware de radio.

Para ejecutar desktop compilado: `npm --prefix desktop run start`. La salida frontend está en `phone/dist/phone/browser`; para pruebas por USB usa `npm run phone`.

Más detalles: [frontend y API del stick](phone/README.md).
"# fpv-phone-controller" 
