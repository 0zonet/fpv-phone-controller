# Pairing mediante QR

## Arquitectura

- shared/src/pairing.ts: funciones puras createPairingPayload, encodePairingPayload, decodePairingPayload, createPairingUrl y pairingEndpoint; contrato único para PC y teléfono.
- desktop/src/pairing/pairing-service.ts: detecta interfaces útiles usando el filtro existente y genera el PNG con node-qrcode 1.5.4. El companion selecciona la interfaz, escucha en ella y muestra su QR.
- phone/src/app/core/services/pairing.service.ts: interpreta y valida el enlace; devuelve un endpoint ws, sin conectar ni cambiar controles.
- PairingFlowService: guarda el endpoint, inicia el transporte existente y navega al controller al conectar. El componente /connect solo presenta estado y acciones.
- La transmisión comienza en el controller existente. No se añade ningún loop ni se cambia vJoy, calibración, mapping o failsafe.

Payload versión 1: { version: 1, host, port, token }. token conserva la autorización existente y cambia en cada inicio del companion. Es base64url, sin cifrado: no publiques capturas del QR. Se rechazan campos adicionales, versiones desconocidas, hosts distintos de IPv4 privadas RFC1918, puertos no enteros fuera de 1..65535 y claves sin el formato requerido.

El enlace completo es https://fpv.brycofre.com/connect?data=... . Tras conectar, se reemplaza por / en el historial. La conexión sigue limitada a la subred seleccionada, origen permitido y clave temporal. No hay acceso por Internet.

## Protocolo 2 (PC → teléfono)

Compatible en ambos sentidos con versiones anteriores:
- Al conectar, el companion envía {"type":"hello","protocol":2,"capabilities":["ack","close-codes"]}.
- Tras recibir estado, responde {"type":"ack","sequence":N} con el último sequence, como mucho cada 500 ms, y repite el último cada segundo si no llega nada nuevo (latido). El teléfono calcula la latencia (RTT) con el instante de envío de ese sequence y la muestra en la píldora; con un companion antiguo, sin hello, muestra "— ms".
- Con hello recibido, si pasan unos 2 s sin ack, el teléfono da la conexión por perdida aunque TCP no se haya cerrado.
- Códigos de cierre: 4001 = el PC cerró la sesión (Disconnect phone); 4003 = clave antigua (QR de una sesión anterior) con origen y red válidos: el servidor acepta el upgrade solo para cerrarlo con 4003, porque el navegador no puede leer el 401 de un handshake rechazado. Origen o red no permitidos se siguen rechazando en el handshake.
- Reconexión automática (solo ante cierre inesperado, nunca tras 4001 ni 4003): reintentos a 0,5, 1, 2 y 4 s, y luego cada 4 s, durante unos 30 s. Los botones vuelven a OFF y la secuencia empieza de nuevo en cada conexión. Si el companion se reinició, su clave cambió: el reintento recibe 4003 y el teléfono pide escanear el QR nuevo.
- Los teléfonos antiguos no escuchan mensajes del PC y tratan 4001/4003 como un cierre normal. Los companions antiguos no envían nada y el teléfono nuevo sigue funcionando sin latencia ni detección por ack.

## Publicar y generar

1. Sube estos cambios del monorepo a GitHub para que Vercel despliegue la nueva ruta /connect. La configuración existente de Vercel sirve index.html para esa ruta.
2. Ejecuta npm test y npm run build.
3. En Windows x64 con Node 24, ejecuta npm run package:windows.
4. Ejecuta npm run test:package. Verifica el PNG decodificando el QR real, la coincidencia con el endpoint autorizado, la ruta HTTP /connect, la autorización del origen público y el cierre del paquete con driver fake.
5. Distribuye dist/FPVPhoneControllerSetup.exe. El usuario final no necesita Node.

PWA_URL permite sobrescribir la URL pública; distribution.config.json usa https://fpv.brycofre.com. PWA_URL vacío genera un QR de preview local HTTP (sin instalación PWA/service worker).

## Probar desde otro dispositivo

1. Instala el nuevo companion y abre la aplicación con vJoy disponible.
2. Conecta PC y Android a la misma Wi-Fi o habilita USB tethering. El teléfono necesita acceso a Internet para abrir inicialmente la PWA pública.
3. Escanea el QR con la cámara; abre el enlace en Chrome actualizado.
4. Permite acceso a la red local si aparece el aviso. Si hace falta un gesto explícito para pedir el permiso, pulsa Retry.
5. Comprueba Phone: Connected en el PC y el controller en el teléfono. Mueve los sticks y verifica joy.cpl.
6. Cierra/reinicia el companion: la conexión anterior debe cerrarse. Escanea el QR nuevo; la clave anterior deja de autorizar.
7. Prueba un enlace con data inválido: debe mostrar Unable to connect to PC y ofrecer conexión manual sin abrir un socket.
8. Prueba con el companion cerrado: aparece el error al terminar el timeout existente de 8 segundos; Retry inicia un único intento nuevo.
9. Si hay varias redes, cambia Advanced > PC network y escanea el nuevo QR.

Un sitio HTTPS que conecta a un WebSocket local depende del permiso de red local y del soporte del navegador. Las pruebas automatizadas no sustituyen esta prueba en Android real. Si la PWA ya estaba instalada, ábrela con red y recárgala para recibir la actualización.
