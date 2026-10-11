# FPV Phone Controller

Android PWA → local WebSocket companion → vJoy → FPV simulator.
Public PWA: https://fpv.brycofre.com

- [User guide](USER_README.md): installation, QR connection, Uncrashed and troubleshooting.
- [Developer guide](DEVELOPER_README.md): architecture, protocol, versioning, builds and packaging.
- [Clean PC checklist](CLEAN_PC_CHECKLIST.md): real-machine beta acceptance.

Run npm run release on Windows x64 with Node 24 to produce the versioned installer and release documents in release/.
The root package.json is the only product-version source. The beta adds distribution quality and diagnostics without changing the control pipeline.
