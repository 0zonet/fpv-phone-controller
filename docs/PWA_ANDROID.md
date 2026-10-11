# Reinstalar y comprobar la PWA en Android

Primero publica estos cambios del repositorio en Vercel. El build local no cambia lo que sirve fpv.brycofre.com.

1. Mantén pulsado el icono antiguo de FPV Phone Controller > Información de la aplicación > Desinstalar. Si era solo un acceso directo, elimina también ese acceso.
2. En Chrome > Configuración > Configuración de sitios > Todos los sitios, busca fpv.brycofre.com y elimina/restablece sus datos. Esto elimina el endpoint guardado: después habrá que escanear el QR otra vez. Los nombres del menú varían por versión de Android/Chrome.
3. Cierra las pestañas abiertas de la web y la app anterior.
4. Abre https://fpv.brycofre.com/ directamente en Chrome, fuera de incógnito y fuera del navegador de cámara/mensajería. No uses el dominio vercel.app para instalar esta app.
5. Espera a que cargue. El registro Angular del service worker puede esperar hasta 30 segundos.
6. Menú de Chrome > Instalar aplicación (o Añadir a pantalla de inicio > Instalar, si Chrome ofrece esa elección). Evita Crear acceso directo.
7. Cierra Chrome y abre la app desde su icono instalado. El panel Debug debe indicar Modo: standalone y Service worker: Activo. No pulses el botón de pantalla completa para esta comprobación: fullscreen por sí solo no demuestra instalación standalone.
8. Abre el companion y escanea su QR para guardar el pairing otra vez. Android puede abrir ese enlace en Chrome o en la app instalada según sus asociaciones; la barra de una pestaña de cámara no significa que la app instalada tenga display browser.
9. Abre la app desde su icono: debe mostrar Conectar y ninguna URL ni token. Si no hay PC guardado, aparece No hay un PC emparejado y Conexión manual.
10. Comprueba Ajustes > Conexión avanzada: solo muestra endpoint sin query, host y puerto. Pega el endpoint completo del companion; la clave debe desaparecer del campo y seguir funcionando internamente.

## Evidencia y límites

Antes de estos cambios, producción respondía 200 a /, /manifest.webmanifest, /ngsw.json y /ngsw-worker.js; manifest tenía application/manifest+json y display standalone. ./ en scope/start_url ya resolvía a / porque el manifest está en la raíz: cambiarlo a / elimina ambigüedad pero no prueba por sí solo la causa de la barra.

La configuración mantiene el service worker oficial de Angular, habilitado solo en producción, y los iconos 192/512. display_override prioriza standalone y luego fullscreen; display sigue standalone. id queda / para no crear otra identidad de app. Vercel obliga a revalidar el manifest; Angular actualiza su versión cuando cambia ngsw.json. Una instalación antigua no se transforma inmediatamente solo por cambiar el archivo.

mobile-web-app-capable se incluye por el requisito Android. No añadimos apple-mobile-web-app-capable: no se certifica iOS en esta beta y el manifest es la fuente de instalación moderna.

Disponibilidad de los archivos no demuestra activación en un Android concreto. La comprobación del modo, instalación real y service worker activo requiere abrir la app instalada en ese teléfono.

Para diagnóstico con Chrome DevTools: Application > Manifest debe mostrar id/start_url/scope /, display standalone e iconos sin errores; Application > Service Workers debe mostrar ngsw-worker.js activated para este origen. No compartas capturas de la URL del pairing: contienen la clave.

Referencia: https://web.dev/learn/pwa/web-app-manifest
