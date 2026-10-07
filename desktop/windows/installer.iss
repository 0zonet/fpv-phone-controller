#ifndef AppVersion
#define AppVersion "0.2.0"
#endif
[Setup]
AppId={{BA566E62-FFAB-4A0F-A358-5E79BC726EB0}
AppName=FPV Phone Controller
AppVersion={#AppVersion}
AppPublisher=FPV Phone Controller
DefaultDirName={localappdata}\Programs\FPV Phone Controller
DefaultGroupName=FPV Phone Controller
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
SetupArchitecture=x64
MinVersion=10.0.22000
OutputDir=..\..\dist
OutputBaseFilename=FPVPhoneControllerSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=app.ico
UninstallDisplayIcon={app}\FPVPhoneController.exe
CloseApplications=yes
RestartApplications=no
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
[Files]
Source: "..\..\dist\windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\FPV Phone Controller"; Filename: "{app}\FPVPhoneController.exe"
Name: "{group}\Help"; Filename: "{app}\USER_README.html"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
[Run]
Filename: "{app}\FPVPhoneController.exe"; Description: "Open FPV Phone Controller"; Flags: nowait postinstall skipifsilent
