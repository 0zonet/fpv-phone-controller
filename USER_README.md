# FPV Phone Controller — Beta

## Installation

Use a Windows 11 x64 PC and an Android phone. Chrome for Android, updated, is the recommended browser. This beta has been tested end-to-end by the project owner with Uncrashed; other devices, browsers and simulators are not yet certified.

Download the Setup from the official beta link, install it and open FPV Phone Controller. No Node.js or development tools are required. The beta installer is unsigned; verify who sent it before accepting any Windows warning.

The Setup includes the virtual joystick driver (vJoy 2.2.2.0, signed by Brunner). If your PC does not have a compatible vJoy yet, the Setup installs and configures it for you; Windows asks for administrator permission once. If vJoy is already installed and has a suitable device, no permission is requested. The Setup never changes vJoy devices you already use for other apps: if device 1 is taken, it creates the next free device. If you cancel the permission prompt, the app is still installed and offers Repair driver.

## Connecting your phone

1. Connect PC and phone to the same Wi-Fi, or enable USB tethering on Android.
2. Wait for the Controller and Server chips to show Ready.
3. Scan the QR with your phone camera and open the link in Chrome.
4. Allow local-network access if requested. The controller opens automatically and the Phone chip shows Connected, with live mini sticks and packets per second.

If the controller page is already open (for example, installed as an app), tap Escanear QR to scan from inside it. The in-app scanner needs the published HTTPS page; in the local preview (http://IP:port) the browser blocks the camera, so use the phone camera app or Conexión manual instead.

The public PWA is https://fpv.brycofre.com. You need Internet access to open it initially. You can install it from Chrome's menu.

New QR restarts the connection and invalidates the previous link. Scan the new QR. Copy link is an alternative. Disconnect phone ends the session from the PC. Advanced contains the PC network selector, the manual WebSocket endpoint (its key is hidden; the copy button copies it complete), the vJoy device, Test joystick, Help and the logs folder.

## Uncrashed setup

Select vJoy Device (Advanced shows which vJoy device number the app uses). Assign each axis by moving it alone: roll = X, pitch = Y, yaw = Z, throttle = Slider. Run Stick calibration across the full range. Leave Throttle gamepad mode off. Axis numbers can differ; do not assume throttle is Axis3.

To check Windows first: Advanced > Test joystick opens joy.cpl. X/Y must follow the right stick; Z yaw; Slider throttle.

## Troubleshooting

- Virtual controller needs repair: click Repair driver and accept the Windows permission prompt. It reinstalls the bundled driver and configures the device, then checks again.
- Joystick occupied: close other feeders and click Check again.
- Port occupied: click Use another port. The app picks a free port, remembers it and shows a new QR. Or close the other app using the port and Retry.
- No network: connect Wi-Fi/Ethernet or USB tethering (Open network settings opens Windows network settings); choose the shared network in Advanced.
- Unable to connect: check both devices share the network, allow local-network access in Chrome and tap Retry. If the window says "Windows Firewall may be blocking it", click Allow on private networks and accept the Windows prompt (it allows only this app, on private networks and your local subnet; uninstalling removes it). If your home network is set to Public, set it to Private in Open network settings. Never disable the firewall or open router ports.
- Old QR: if a phone uses a QR from a previous session, the window says so. Scan the current QR again.
- Connection lost: restore the network, lower throttle on the phone and Retry. After restarting Windows companion, scan its new QR.
- Persistent error: Logs (bottom of the window) opens the logs folder. Send the logs and your app version to the person who provided the beta. Logs contain local IPs and technical details; they omit continuous stick values and pairing keys.

If packets stop for 250 ms, failsafe resets the controls. Keep the phone app visible. Use only a trusted local network.

## How to uninstall

Close FPV Phone Controller. Windows Settings > Apps > Installed apps > FPV Phone Controller > Uninstall.

Uninstalling FPV Phone Controller does not uninstall vJoy, because other apps may use it. To remove it, uninstall "vJoy Device Driver" from Installed apps. Logs, preferences and the chosen vJoy device remain in %LOCALAPPDATA%/FPVPhoneController; delete that folder manually if desired.

## Botones virtuales

El instalador configura el dispositivo con 8 botones. Si usas un dispositivo vJoy que ya tenía menos, los botones por encima de ese número se ignoran y Advanced lo indica. ARM = Button 1 (toggle), RESET = Button 2 (mantener pulsado), AUX 1/2 = Buttons 3/4 (toggle). Compruébalos primero en joy.cpl → vJoy → Properties → Test. Al desconectarte, todos se liberan. Los nombres no asignan automáticamente acciones del simulador.
