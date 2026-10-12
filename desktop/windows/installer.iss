#ifndef AppVersion
#error AppVersion must be provided by the release script
#endif
[Setup]
AppId={{BA566E62-FFAB-4A0F-A358-5E79BC726EB0}
AppName=FPV Phone Controller
AppVersion={#AppVersion}
VersionInfoVersion={#WindowsVersion}
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
[UninstallRun]
; The app creates this firewall rule only when the user clicks "Allow on private networks" (one UAC).
; Removing it needs admin too, so it runs elevated and only if the rule exists.
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""FPV Phone Controller (private network)"""; Flags: runhidden shellexec waituntilterminated; Verb: runas; Check: FirewallRuleExists; RunOnceId: "RemoveFirewallRule"
[Code]
// vJoy is bundled ({app}\vjoy) and configured by vjoy-setup.cjs (desktop/src/drivers/vjoy/vjoy-setup.ts).
// 1. Probe without admin: a compatible vJoy with a fitting device is just recorded, no UAC.
// 2. Only if vJoy is missing/incompatible or no fitting device exists: one elevated run that
//    installs vJoy silently (if needed) and creates the device on the first free ID.
// Cancelling the UAC keeps the app installed; the window then offers "Repair driver".
// Uninstalling the app never uninstalls vJoy, because other apps may use it.
const
  VJoyNeedsAdmin = 10; // SetupExit.NEEDS_ADMIN

function VJoySetupParams(Mode: String): String;
begin
  Result := AddQuotes(ExpandConstant('{app}\vjoy-setup.cjs')) + ' ' + Mode +
    ' --state-dir ' + AddQuotes(ExpandConstant('{localappdata}\FPVPhoneController'));
end;

procedure SetupVJoy;
var
  Engine: String;
  ResultCode: Integer;
begin
  Engine := ExpandConstant('{app}\runtime\companion-engine.exe');
  WizardForm.StatusLabel.Caption := 'Checking the virtual controller driver...';
  if not Exec(Engine, VJoySetupParams('--probe'), ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('vJoy probe could not start: ' + SysErrorMessage(ResultCode));
    Exit;
  end;
  Log('vJoy probe exit code: ' + IntToStr(ResultCode));
  if ResultCode <> VJoyNeedsAdmin then Exit;
  WizardForm.StatusLabel.Caption := 'Installing the virtual controller driver...';
  if ShellExec('runas', Engine, VJoySetupParams('--repair --install if-needed'), ExpandConstant('{app}'),
    SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Log('vJoy setup exit code: ' + IntToStr(ResultCode))
  else
    Log('vJoy setup not run (UAC cancelled or failed): ' + SysErrorMessage(ResultCode));
end;

function FirewallRuleExists: Boolean;
var
  ResultCode: Integer;
begin
  // netsh exits with 0 when a rule with this name exists; reading needs no admin.
  Result := Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall show rule name="FPV Phone Controller (private network)"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then SetupVJoy;
end;
