# Clean PC beta checklist

Record product version, Windows edition/build, phone model, Android version, Chrome version, vJoy version, network type and Uncrashed version. Mark each item Pass/Fail and attach logs for failures.

- [ ] Use another Windows 11 x64 physical PC with no Node.js, npm, Angular CLI or repository.
- [ ] Download only the beta Setup (and its checksum/short user guide) from the beta release link.
- [ ] Install as a normal user. Verify shortcuts and that the app opens without a terminal or development tools.
- [ ] Verify the desktop beta version; verify the PWA version in pairing or Debug.
- [ ] On a PC without vJoy, verify a clear driver message and Install driver. No driver/admin installation happens silently.
- [ ] Explicitly install the supported vJoy driver and enable device 1 with X, Y, Z and Slider. Restart Windows if requested.
- [ ] Open the companion: Virtual joystick, WebSocket server, Network and Advanced checks become Ready.
- [ ] Verify first-run instructions. Hide them with Got it; reopen the app and verify they stay hidden. Advanced > Show instructions restores them.
- [ ] Connect phone and PC to the same Wi-Fi or USB tethering. Choose the correct network in Advanced if necessary.
- [ ] Scan the QR; Chrome opens the HTTPS PWA. Allow local-network access if prompted. No typing or copying an endpoint is required.
- [ ] Verify Phone: Connected and usable sticks.
- [ ] Open Advanced > Test joystick (joy.cpl). Confirm roll X, pitch Y, yaw Z and throttle Slider independently across their ranges.
- [ ] Enable at least 8 buttons in Configure vJoy. In joy.cpl verify ARM → Button 1, RESET → Button 2 while held, AUX 1/2 → Buttons 3/4. Disconnect with toggles ON and confirm every button releases; reconnect with toggles OFF. Verify button presses and both sticks work simultaneously.
- [ ] In Uncrashed select vJoy Device, assign by individual axis movement and run Stick calibration. Confirm all four axes are independent.
- [ ] Stop/lose phone connectivity: verify connection-lost message and failsafe resets the joystick (throttle minimum, other axes center). Lower phone throttle and Retry.
- [ ] Regenerate QR: verify the previous connection closes, the new QR differs, the new scan connects and the old link no longer authorizes.
- [ ] Test Copy connection link and Advanced manual fallback.
- [ ] Test an invalid QR link: a friendly error offers Manual connection; no invalid endpoint is opened.
- [ ] Close another feeder if the virtual joystick is occupied; verify the actionable message and recovery with Retry.
- [ ] Disconnect network/retry: verify no-network message. Restore it and Retry.
- [ ] If firewall blocks access, verify troubleshooting guidance without claiming firewall detection or silently changing rules.
- [ ] Advanced > Open logs folder: verify startup/version/network/driver/server/phone/failsafe/error events; no continuous stick samples or pairing tokens.
- [ ] Close normally; verify joystick reset/release. Reopen and connect by scanning the new QR.
- [ ] Uninstall from Windows Settings > Apps. Verify app/shortcuts are removed. vJoy and local logs/preferences remain separate.
- [ ] Record every failure and known limitation before calling this beta accepted.

Automated tests are already part of npm run release; this checklist is a real-machine acceptance test, not an assertion that it has passed on a clean PC.
