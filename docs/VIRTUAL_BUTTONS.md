# Botones virtuales

Los cuatro ejes, su calibración y los sticks conservan su comportamiento. El mismo dispositivo vJoy recibe ocho botones independientes. Índices internos 0..7 = botones vJoy 1..8.

| UI | Índice | vJoy | Modo |
|---|---:|---:|---|
| ARM | 0 | 1 | Toggle |
| RESET | 1 | 2 | Momentary |
| AUX 1 | 2 | 3 | Toggle |
| AUX 2 | 3 | 4 | Toggle |
| AUX 3 / AUX 4 | 4..5 | 5..6 | Toggle (hoja «4 botones más») |
| BTN 7 / BTN 8 | 6..7 | 7..8 | Momentary (hoja «4 botones más») |

Los nombres son etiquetas configurables, no acciones impuestas al simulador. Valores de fábrica: phone/src/app/core/models/controller-button.model.ts. En la PWA, **Ajustes → Botones** permite cambiar la etiqueta (hasta 8 caracteres) y el modo (Toggle o Mantener) de los ocho; se guardan en el teléfono (localStorage, clave fpv-settings-v1). Cambiar el modo suelta ese botón. El botón 1 se pinta en rojo mientras está activo (ARMED si se llama ARM). No hay editor de mapping ni macros.

## Probar en Windows

1. El instalador configura el dispositivo vJoy con 8 botones. Si el companion usa un dispositivo con menos botones, los que superen ese número se ignoran y Advanced lo indica ("This vJoy device has N buttons…").
2. Instala esta versión del companion y publica/actualiza la PWA. Conecta por QR.
3. Ejecuta joy.cpl, selecciona vJoy Device y abre Properties → Test.
4. ARM enciende el botón 1 hasta otro tap. RESET enciende el 2 mientras lo mantienes presionado. AUX 1/2 alternan los botones 3/4.
5. Toca RESET a la vez que mueves ambos sticks: el botón y los ejes deben responder independientemente.
6. Deja los toggle activos y desconecta el teléfono. Todos los botones deben apagarse inmediatamente al cerrar la conexión o después del failsafe de 250 ms sin paquetes. Reconecta: los toggle del teléfono vuelven a OFF. Cambiar de aplicación o esconder la PWA también limpia los botones.
7. Toca «4 botones más»: la hoja muestra los botones 5..8 (AUX 3, AUX 4, BTN 7, BTN 8). Comprueba en joy.cpl que encienden los botones 5..8. Cerrar la hoja suelta los botones momentáneos; los toggle conservan su estado y el botón «4 botones más» indica cuántos están en ON.

## FPV SkyDive

Primero verifica joy.cpl. Abre Settings → Controls, selecciona vJoy como entrada joystick y conserva/calibra los cuatro ejes. En el mapping de acciones, activa la asignación de Arm/Disarm y toca ARM (botón 1); asigna Reset con RESET (botón 2). AUX 1/2 emiten botones 3/4: asígnalos solo a acciones que quieras usar. No cambies una entrada de eje para asignar un botón.

Las opciones exactas dependen de la versión del simulador. Para detectar otra pulsación de ARM, vuelve primero a OFF. Si el simulador trata Arm/Disarm como una acción por pulsación, su estado armado no necesariamente coincide con el indicador ON/OFF del botón: este muestra el estado del botón virtual. Algunas versiones pueden aceptar canales de switch en vez de botones de joystick. Si no ofrecen captura de botones, este cambio no crea canales AUX analógicos ni keybindings para resolverlo.

Referencia del nuevo menú Controls y mapping: https://store.steampowered.com/news/app/1278060/view/666111203904324323
No se ha probado físicamente esta versión de los botones en FPV SkyDive.

## Protocolo y seguridad

Cada paquete controller-state conserva type, sequence, timestamp y axes; añade buttons como array de booleanos en el nivel superior. La PWA envía exactamente ocho valores en el loop existente, sin enviar por cada pointer event ni crear otro loop. El desktop rechaza arrays mayores de ocho y valores no booleanos. Arrays cortos se completan con false. Mensajes anteriores sin buttons se interpretan como todos liberados.

VirtualController.updateButtons está separado del transporte y del mapper de ejes. El driver comprueba GetVJDButtonNumber y convierte índices a SetBtn 1..8. Reset, desconexión y shutdown liberan todos los botones; se intentan todas las liberaciones aunque una escritura devuelva un error. No se agregan nuevas dependencias ni vibración.
