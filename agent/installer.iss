; Inno Setup script for the Orbit agent.
;
; Wraps the PyInstaller onedir output into a normal Windows installer, so users
; get "Orbit" in the Start menu instead of a folder with an _internal directory
; next to the .exe. Build after PyInstaller, from the `agent` folder:
;
;     iscc /DAppVersion=1.0.5 installer.iss
;
; Output lands in agent\installer_output\Orbit-Setup.exe.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

#define AppName "Orbit"
#define AppExe "Orbit.exe"

[Setup]
; Never change AppId: it is how Windows recognises an existing install, so a
; new value would install alongside the old copy instead of upgrading it.
AppId={{65BD6C68-CC90-476C-BD2A-03F7FCC0CB1C}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=yovrah
AppPublisherURL=https://github.com/yovrah/Orbit
AppSupportURL=https://github.com/yovrah/Orbit/issues
AppUpdatesURL=https://github.com/yovrah/Orbit/releases
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE
OutputDir=installer_output
OutputBaseFilename=Orbit-Setup
SetupIconFile=orbit.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Program Files needs elevation; the agent itself runs unelevated afterwards.
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
; Same mutex the agent holds, so Setup can say "close Orbit first" instead of
; failing halfway through replacing a locked .exe.
AppMutex=Global\Orbit_Agent_SingleInstance

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
; The whole PyInstaller onedir tree, _internal included — users never see it.
Source: "dist\Orbit\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Start {#AppName} now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Drop the "Start with Windows" entry so uninstalling really removes Orbit.
; Harmless if the user never enabled it.
Filename: "{sys}\reg.exe"; Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v Orbit /f"; Flags: runhidden; RunOnceId: "RemoveOrbitAutostart"

; Runtime state (logs in %LOCALAPPDATA%, the paired-devices DB in %APPDATA%) is
; deliberately left alone: the uninstaller runs elevated, so those paths would
; resolve to the elevating admin's profile rather than the user's. Reinstalling
; therefore keeps your paired phones.
