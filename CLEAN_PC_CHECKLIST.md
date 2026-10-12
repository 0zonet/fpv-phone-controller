# Clean PC beta checklist

Record product version, Windows edition/build, phone model, Android version, Chrome version, vJoy version, network type and Uncrashed version. Mark each item Pass/Fail and attach logs for failures.

- [ ] Use another Windows 11 x64 physical PC with no Node.js, npm, Angular CLI or repository.
- [ ] Download only the beta Setup (and its checksum/short user guide) from the beta release link.
- [ ] Install as a normal user. Verify shortcuts and that the app opens without a terminal or development tools.
- [ ] Verify the desktop beta version; verify the PWA version in pairing or Debug.
- [ ] On a PC without vJoy, the Setup shows exactly one UAC prompt and installs vJoy 2.2.2.0 silently. The app opens with Virtual Controller Ready. Restart Windows if requested.
- [ ] On a PC with vJoy 2.2.2.0 and a suitable device 1, the Setup shows no UAC prompt.
- [ ] With device 1 configured differently (for example 2 axes, 4 buttons), the Setup keeps device 1 unchanged and creates the first free device with X, Y, Z, Slider and 8 buttons.
- [ ] Cancel the UAC prompt: the app still installs and shows Repair driver; Repair driver then fixes it.
- [ ] Open the app: dark window (dark title bar), Controller and Server chips Ready, Phone Waiting, QR visible. Text is sharp at 100 %, 125 % and 150 % display scaling.
- [ ] Advanced shows "How it works", network selector, IP, port, masked endpoint (copy button copies the full endpoint), vJoy driver and device, Test joystick, Help, Open logs folder and Third-party licenses.
- [ ] Connect phone and PC to the same Wi-Fi or USB tethering. Choose the correct network in Advanced if necessary.
- [ ] Scan the QR; Chrome opens the HTTPS PWA. Allow local-network access if prompted. No typing or copying an endpoint is required.
- [ ] Verify Phone: Connected and usable sticks.
- [ ] Open Advanced > Test joystick (joy.cpl). Confirm roll X, pitch Y, yaw Z and throttle Slider independently across their ranges.
- [ ] In joy.cpl verify ARM → Button 1, RESET → Button 2 while held, AUX 1/2 → Buttons 3/4. Disconnect with toggles ON and confirm every button releases; reconnect with toggles OFF. Verify button presses and both sticks work simultaneously.
- [ ] In Uncrashed select vJoy Device, assign by individual axis movement and run Stick calibration. Confirm all four axes are independent.
- [ ] Stop/lose phone connectivity: verify connection-lost message and failsafe resets the joystick (throttle minimum, other axes center). Lower phone throttle and Retry.
- [ ] New QR: verify the previous connection closes, the new QR differs, the new scan connects and the old link no longer authorizes.
- [ ] Test Copy link and the manual endpoint (phone Settings > Conexión). With the phone connected, the mini sticks follow the phone; Disconnect phone shows "disconnected" on the phone.
- [ ] Scan an old QR after New QR: the window shows "Your phone used an old QR".
- [ ] Test an invalid QR link: a friendly error offers Manual connection; no invalid endpoint is opened.
- [ ] Close another feeder if the virtual joystick is occupied; verify the actionable message and recovery with Retry.
- [ ] Disconnect network/retry: verify no-network message. Restore it and Retry.
- [ ] Firewall: on first launch click Cancel in the Windows Security prompt. After 45 s without the phone reaching the PC the window shows "Windows Firewall may be blocking it". Allow on private networks shows one UAC; afterwards the phone connects. No rule is ever created without clicking it.
- [ ] With the network set to Public, the firewall screen offers Open network settings first.
- [ ] After uninstalling, wf.msc no longer lists "FPV Phone Controller (private network)" (a UAC appears only if the rule existed).
- [ ] Advanced > Open logs folder: verify startup/version/network/driver/server/phone/failsafe/error events; no continuous stick samples or pairing tokens.
- [ ] Close normally; verify joystick reset/release. Reopen and connect by scanning the new QR.
- [ ] Uninstall from Windows Settings > Apps. Verify app/shortcuts are removed. vJoy stays installed (other apps may use it) and local logs/preferences remain.
- [ ] Record every failure and known limitation before calling this beta accepted.

Automated tests are already part of npm run release; this checklist is a real-machine acceptance test, not an assertion that it has passed on a clean PC.
