[Setup]
AppId=CreatorDeskDesktop
AppName=Creator Desk
AppVersion={#Version}
AppPublisher=Creator Desk
DefaultDirName={localappdata}\Programs\Creator Desk
DefaultGroupName=Creator Desk
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=Creator-Desk-{#Version}-windows-x64-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\creator-desk.exe
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Files]
Source: "{#AppDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Creator Desk"; Filename: "{app}\creator-desk.exe"
