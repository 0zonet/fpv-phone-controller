# FPV Phone Controller — Beta

## Installation

Use a Windows 11 x64 PC and an Android phone. Chrome for Android, updated, is the recommended browser. This beta has been tested end-to-end by the project owner with Uncrashed; other devices, browsers and simulators are not yet certified.

Download the Setup from the official beta link, install it and open FPV Phone Controller. No Node.js or development tools are required. The beta installer is unsigned; verify who sent it before accepting any Windows warning.

The virtual joystick requires the separate signed BRUNNER vJoy 2.2.2.0 driver. If it is missing, click Install vJoy to open the download page in your browser. FPV Phone Controller stays open and does not download or install the driver. After installing, click Check again. In Configure vJoy, enable device 1 with X, Y, Z and Slider. Driver installation may ask for administrator permission.

## Connecting your phone

1. Connect PC and phone to the same Wi-Fi, or enable USB tethering on Android.
2. Wait for Virtual joystick, WebSocket server and Network to show Ready.
3. Scan the QR with your phone camera and open the link in Chrome.
4. Allow local-network access if requested. The controller opens automatically and Windows shows Phone: Connected.

The public PWA is https://fpv.brycofre.com. You need Internet access to open it initially. You can install it from Chrome's menu.

Regenerate QR restarts the connection and invalidates the previous link. Scan the new QR. Copy connection link is an alternative. Advanced contains network selection and the manual WebSocket endpoint.

## Uncrashed setup

Select vJoy Device. Assign each axis by moving it alone: roll = X, pitch = Y, yaw = Z, throttle = Slider. Run Stick calibration across the full range. Leave Throttle gamepad mode off. Axis numbers can differ; do not assume throttle is Axis3.

To check Windows first: Advanced > Test joystick opens joy.cpl. X/Y must follow the right stick; Z yaw; Slider throttle.

## Troubleshooting

- Driver required: Install vJoy, configure device 1 and Check again. If the browser cannot open, use Copy download link.
- Joystick occupied: close other feeders and Retry.
- Port occupied: close the other companion/app using the displayed port and Retry.
- No network: connect Wi-Fi/Ethernet or USB tethering; choose the shared network in Advanced.
- Unable to connect: check both devices share the network, allow local-network access in Chrome and tap Retry. Review Windows private-network firewall permissions. Never disable the firewall or open router ports.
- Invalid QR: scan the current QR again.
- Connection lost: restore the network, lower throttle on the phone and Retry. After restarting Windows companion, scan its new QR.
- Persistent error: Advanced > Open logs folder. Send the logs and your app version to the person who provided the beta. Logs contain local IPs and technical details; they omit continuous stick values and pairing keys.

If packets stop for 250 ms, failsafe resets the controls. Keep the phone app visible. Use only a trusted local network.

## How to uninstall

Close the companion. Windows Settings > Apps > Installed apps > FPV Phone Controller > Uninstall.

vJoy is a separate driver and remains installed. Logs and onboarding preferences remain in %LOCALAPPDATA%/FPVPhoneController; delete that folder manually if desired.

## Botones virtuales

En Configure vJoy habilita al menos 8 botones en el dispositivo existente. ARM = Button 1 (toggle), RESET = Button 2 (mantener pulsado), AUX 1/2 = Buttons 3/4 (toggle). Compruébalos primero en joy.cpl → vJoy → Properties → Test. Al desconectarte, todos se liberan. Los nombres no asignan automáticamente acciones del simulador.
