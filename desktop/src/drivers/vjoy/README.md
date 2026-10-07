# vJoy adapter

El adapter usa el SDK C de vJoy mediante Koffi. No utiliza wrappers Node antiguos ni ejecuta instaladores. Solo admite Windows/Node x64 en esta etapa.

Mapping físico: roll → HID X (0x30), pitch → Y (0x31), yaw → Z (0x32), throttle → Slider (0x36). Se consulta mínimo/máximo de cada eje mediante GetVJDAxisMin/Max. ControllerMapper no conoce estos rangos.

Cada estado válido escribe cuatro ejes con SetAxis síncrono. No hay cola ni loop adicional. Son cuatro escrituras sucesivas, no un reporte atómico; esto evita depender de layouts de structs diferentes entre versiones de vJoy. Todos los ejes se intentan escribir antes de informar un error.

connect verifica DLL x64, vJoyEnabled, DriverMatch, existencia del dispositivo, estado libre, ejes y rangos, después adquiere y pone el estado seguro. reset centra X/Y/Z y pone Slider al mínimo. disconnect intenta reset y libera el dispositivo en finally. No usa ResetVJD: sus valores por defecto podrían centrar throttle.

Referencia ABI: [SDK de BRUNNER](https://github.com/BrunnerInnovation/vJoy/blob/master/SDK/inc/vjoyinterface.h). Los BOOL/LONG son enteros de 32 bits en Windows; la convención de llamada es cdecl. [Koffi](https://koffi.dev/) tiene binarios precompilados para Node.

Instalación, configuración y prueba física están en desktop/README.md. Los unit tests utilizan FakeVirtualController y no cargan este driver.
