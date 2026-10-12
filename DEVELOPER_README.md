# Development and release

## Architecture

phone: Angular 20 standalone, signals, Pointer Events, official PWA service worker.
desktop: TypeScript strict, ws, native WinForms window, bundled Node 24 x64 and Koffi/vJoy.
shared: controller protocol, strict pairing codec and generated product version.

The input pipeline remains ControllerState → WebSocket validation → calibration/mapper → VirtualController → vJoy. QR/onboarding/health/logging are distribution concerns, outside the control pipeline. Button handling is independent of axis calibration; native numbering lives in the vJoy driver.

[Virtual buttons: configuration and verification](docs/VIRTUAL_BUTTONS.md).

## Frontend

From the root: npm ci, npm run phone. Production: npm --prefix phone run build.
Vercel imports the root repository; vercel.json builds phone and serves phone/dist/phone/browser. Both / and /connect resolve to index.html.

PairingService validates the payload. PairingFlowService coordinates saving, connecting and navigation. The existing transport manages status and retries; no automatic reconnect loop was added. Version appears in pairing and the controller Debug panel.

## Desktop

npm run desktop starts the development console server. The distributed entry is desktop/src/distribution/windows-entry.ts and the UI is desktop/windows/CompanionWindow.cs.

Health checks report driver/device, actual port binding/WebSocket listening, private IP selection and QR generation. Driver failures map to user messages; technical details go to logs. A missing network leaves dependent checks Not checked. Firewall reachability is not asserted: a waiting hint suggests permissions after 45 seconds.

Logs: %LOCALAPPDATA%/FPVPhoneController/logs/companion.jsonl, with four rotated files of approximately 2 MB each. Native-window errors use a separately bounded window.jsonl. Logs include version, lifecycle, selected IP, connection changes, failsafe and errors. They omit stick samples and redact authorization keys. FPV_DATA_DIR isolates test data. Logs stay local.

Regenerate QR restarts the existing companion, closes the phone connection and produces a new session token. The pairing schema is unchanged. Onboarding dismissal is a local per-user preference.

## Protocol and network

Controller JSON: type controller-state, sequence, timestamp, axes { throttle, yaw, pitch, roll }, buttons [boolean × 8]. Legacy messages without buttons release all buttons; short arrays are padded with false. Validation rejects non-booleans and arrays longer than eight. The existing 60 Hz latest-state transmission carries axes and buttons together; failsafe releases all eight buttons as well as resetting axes.

Pairing v1: host/private IPv4, port/integer 1..65535, token/48 hexadecimal characters, version/1; base64url in /connect?data=. It is not encrypted. The distribution binds one selected local interface and requires same-subnet peer, allowed Origin and token.

Public PWA URL comes from distribution.config.json, optionally overridden by PWA_URL at build time. Never publish runtime tokens or QR screenshots.

## Version

Only root package.json defines the product version. Use npm version VERSION --no-git-tag-version to update it and package-lock.json. Current first-beta identifier advances the previous 0.3.0 release.

scripts/generate-version.mjs generates shared/src/product-version.ts before Angular dev/build/test and desktop build/test. The generated source is ignored in Git. Distribution JSON, native informational version, installer and release filenames derive from the root version.

Windows numeric file version derives from major.minor.patch.betaNumber. This numeric representation is required for Windows version resources; it is not a second manually maintained product version.

## Builds, packaging and release

Build machine: Windows x64, Node 24 x64 and npm. End users install none of these.

npm test — frontend/desktop tests.
npm run build — shared, desktop and production Angular.
npm run build:desktop — production PWA, desktop and native packaged app.
npm run package:windows — also builds the legacy dist/FPVPhoneControllerSetup.exe.
npm run test:package — native UI self-test, real PNG QR decoding, route, authorized connection, logs, lifecycle, occupied-port errors and new/old QR authorization after restart, using a fake driver.

Single release command: npm run release

It runs tests, all builds, native packaging verification and installer compilation. Only after success does it copy the versioned installer, release.json, SHA256SUMS.txt, USER_README.md and CLEAN_PC_CHECKLIST.md to release/. Older versioned installers can coexist there.

The compiler is downloaded from the official source with pinned hash and cached under .tools. Node's license is fetched during native build. The installer is per-user and unsigned. It bundles the official vJoy 2.2.2.0 installer (downloaded to .tools with a pinned SHA-256) and runs it elevated only when vJoy is missing or incompatible; see docs/DISTRIBUTION.md, "vJoy integrado". It makes no firewall changes.

Publish the new PWA by pushing to GitHub/Vercel, then upload the release installer and checksum to a beta release page. No upload or public release is automatic. Send testers that release page URL. Do not commit release/, dist/ or node_modules/.

## Beta acceptance

Follow CLEAN_PC_CHECKLIST.md on another physical PC. Fake-driver tests do not certify the real driver, installer, Chrome permissions or Uncrashed on another machine.

Known limits: unsigned installer/SmartScreen, only Windows 11 x64 targeted, no browser/version compatibility matrix yet, trusted LAN only, local WS is unencrypted, no automatic updates or advanced reconnection, first PWA load needs Internet, network/firewall restrictions can block pairing. The existing failsafe handles packet silence; forcibly killing the PC/process cannot guarantee orderly driver release.
