# Primera prueba en Uncrashed

## Preparar el companion

Desde la raíz del proyecto, en PowerShell:

```powershell
$env:CONTROLLER_DEBUG = '1'
npm run desktop
```

En otra terminal: `npm run phone`. Abre la dirección HTTP del PC en el teléfono y conecta al WebSocket del companion.

El monitor imprime aproximadamente una vez por segundo RAW (último paquete), CALIBRATED (salida aplicada), packets/s, updates/s, LOST, SEQ y AGE. AGE mide el tiempo local desde la recepción: no es latencia de red. Los huecos de sequence no detectan retransmisiones TCP ni todo retraso posible. Una escritura de los cuatro ejes cuenta como una actualización; el reset del failsafe también cuenta.

## Calibración del proyecto

Edita `desktop/src/config.ts`, sección `calibration`, y reinicia el companion.
Cada eje admite min, max, center, invert y deadzone en unidades de entrada lógicas, independientes de vJoy.

- Roll, pitch y yaw: -1..1, centro 0, deadzone 0.03.
- Throttle: 0..1; center es metadato y no se aplica deadzone ni autocentrado.
- Pitch conserva invert=true para la dirección que verificamos en joy.cpl. Todos los invert son editables; no existe un perfil específico de Uncrashed.
- Deadzone es una fracción del recorrido normalizado desde el centro; tras aplicarla se reescala hasta los extremos. Centros descentrados usan una escala distinta a cada lado.
- Failsafe de 250 ms: throttle y los tres ejes a cero, saltándose toda inversión y calibración. El siguiente paquete válido recupera el control, incluido su throttle persistente.

## Asignación dentro del simulador

La ficha oficial confirma compatibilidad con joysticks reconocidos por Windows:
https://store.steampowered.com/app/1682970/Uncrashed/

La FAQ del desarrollador indica comprobar el nombre del dispositivo en el menú Controls, asignar los cuatro canales y pulsar Calibration:
https://steamcommunity.com/app/1682970/discussions/0/6643422659556525796/?l=french

No se ha probado el simulador en esta máquina ni confirmado la numeración Axis N de tu versión. En el menú Controls asigna por movimiento, no por números supuestos:

| Canal | Eje virtual | Movimiento para identificarlo |
|---|---|---|
| Roll | X | Stick derecho: izquierda/derecha |
| Pitch | Y | Stick derecho: arriba/abajo |
| Yaw | Z | Stick izquierdo: izquierda/derecha |
| Throttle | Slider | Stick izquierdo: abajo/arriba |

1. Inicia el companion y conecta el teléfono antes de abrir Uncrashed. Selecciona vJoy si hay selector de dispositivo.
2. Elige Mode 2 si hay selector de modo y asigna cada canal por separado. Para identificar yaw, deja throttle a media altura: el límite circular reduce el movimiento horizontal en los extremos verticales.
3. Ejecuta la calibración de sticks del simulador. Lleva cada eje individualmente a mínimo y máximo; no uses solo las diagonales. Centra yaw/roll/pitch. Para throttle sigue las indicaciones del asistente: mitad si solicita centro, abajo al finalizar.
4. Si existe Throttle Gamepad Mode, desactívalo: este throttle es persistente y ya recorre mínimo a máximo.
5. En la vista de prueba confirma roll/yaw hacia la derecha, pitch hacia delante al subir el stick, throttle mínimo abajo y máximo arriba. Si una dirección está al revés, invierte ese canal en un solo lugar (companion o simulador) y vuelve a verificar. No deduzcas el signo de vuelo únicamente del dibujo X/Y de Windows.
6. Si el simulador ofrece deadzone adicional, empieza en cero para evitar sumar dos deadzones.

## Observar durante la prueba

- Centro estable sin deriva y extremos completos al mover cada eje individualmente.
- Throttle conserva posición al soltar; los demás canales vuelven a cero.
- Frecuencias cercanas a 60/s, AGE normalmente bajo y sin huecos de sequence.
- Pausas o cambios bruscos: observa AGE, packets/s y FAILSAFE ACTIVE. Cambiar de app o apagar la pantalla puede suspender la transmisión del navegador.
- Al desconectar o superar 250 ms sin paquete válido, la salida calibrada debe ser cero. Al reconectar, baja primero el throttle persistente del teléfono.
- No interpretar AGE como tiempo de ida y vuelta ni intentar alcanzar simultáneamente las cuatro esquinas: los sticks tienen límite circular.

El panel opcional de diagnóstico del teléfono muestra conexión, valores RAW, frecuencia efectiva aproximada y último sequence enviado (el primero es 0). No confirma recepción en el PC; para eso sirve el monitor del companion.
