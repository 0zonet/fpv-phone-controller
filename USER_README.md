# FPV Phone Controller — Guía de uso

Requisitos: PC Windows 11 de 64 bits, teléfono Android con Chrome actualizado y ambos equipos en una red local compartida. No necesitas Node, npm, TypeScript ni Angular CLI.

1. Descarga FPVPhoneControllerSetup.exe desde la publicación oficial del proyecto.
2. Instala y abre FPV Phone Controller desde el menú Inicio. Se instala para tu usuario y permite desinstalarlo desde Configuración de Windows > Aplicaciones.
3. Si aparece "Virtual joystick driver not installed", pulsa Install driver. Se abrirán las instrucciones y la página oficial de vJoy. La instalación del driver es independiente y Windows puede solicitar administrador. El companion no lo instala silenciosamente.
4. Instala vJoy firmado BRUNNER 2.2.2.0 y configura el dispositivo 1 con X, Y, Z y Slider. Cierra otros feeders que puedan ocuparlo. Reinicia el PC si el instalador lo solicita y pulsa Retry en el companion.
5. Conecta celular y PC a la misma Wi-Fi o usa USB tethering. Si hay varias direcciones, elige en PC addresses la red compartida con el celular. Al cambiar de red o reiniciar, copia nuevamente la dirección.
6. Comprueba Virtual Controller: READY y WebSocket: LISTENING. Pulsa Copy Address.
7. Abre la PWA pública indicada por Open PWA en Chrome del teléfono. Instálala desde el menú de Chrome > Añadir a pantalla de inicio / Instalar aplicación. Pega la dirección completa del companion en Conectar al PC y pulsa Conectar. Permite el acceso a red local si Chrome lo solicita. La dirección incluye una clave temporal: no la publiques.
8. Comprueba Phone: CONNECTED. Abre Uncrashed y selecciona vJoy Device. Asigna los ejes por movimiento y ejecuta Stick calibration: roll es X, pitch Y, yaw Z y throttle Slider. La numeración Axis N depende del simulador: no supongas que throttle es Axis3. Mantén Throttle gamepad mode desactivado. No configures ARM/AUX; este MVP solo envía cuatro ejes.

## Verificar en Windows

Pulsa Test joystick o abre Win+R, escribe joy.cpl y acepta. Selecciona vJoy Device > Propiedades > Test.
Mueve un eje a la vez: X/Y corresponden al stick derecho; Z a yaw; Slider a throttle. Slider debe recorrer de mínimo a máximo. Yaw/roll/pitch vuelven al centro; throttle conserva la posición.

## Firewall y conexión

Si Windows pide permiso de red, permite solo redes privadas. Nunca desactives el firewall ni abras el puerto en el router.
Si no conecta, revisa que ambos equipos comparten red, copia la dirección actual y comprueba el permiso de red local de Chrome. Redes de invitados pueden aislar dispositivos.
El puerto es 8080. El companion escucha únicamente en la IP local seleccionada y solo acepta clientes de esa subred, el origen permitido y la clave temporal. Al cambiar de interfaz se reinicia la conexión.
Puedes abrir Firewall para revisar las reglas. La regla, si un administrador la configura, debe limitarse a la aplicación, TCP 8080, perfil Private y LocalSubnet.
Esta versión usa WebSocket local sin cifrado en una red de confianza. La PWA pública usa HTTPS. No es una solución para controlar por Internet.
Firefox, Safari y Chrome antiguos no están incluidos en la compatibilidad de esta primera distribución HTTPS + WebSocket local.

## Prueba local antes de publicar

Si Open PWA dice que no está configurada, esta es una versión de prueba local.
Local preview muestra la dirección HTTP del PC. Escríbela en Chrome del teléfono, abre la web y pega la dirección copiada.
La prueba HTTP funciona como web, pero NO verifica instalación PWA ni service worker en Android. Para eso necesitas la publicación HTTPS.
No hay QR todavía; la arquitectura prepara la dirección para añadirlo después.

## Uso y cierre

Mantén el teléfono con la app visible. Si deja de transmitir durante 250 ms, el companion activa failsafe y baja throttle a cero.
Al volver, baja el throttle del teléfono antes de reconectar: conserva su posición.
Cierra la ventana para resetear y liberar el joystick. Una salida forzada del proceso o corte del PC no garantiza el cierre ordenado.

## Publicación y actualizaciones

Todavía no hay auto-update: para actualizar, instala una versión nueva. El instalador mantiene la identidad de la aplicación.
Un instalador de prueba sin firma puede provocar avisos de SmartScreen. Solo ejecútalo si confías en su procedencia. La firma de código y la prueba del flujo HTTPS en un teléfono real deben completarse antes de anunciar una versión pública.
