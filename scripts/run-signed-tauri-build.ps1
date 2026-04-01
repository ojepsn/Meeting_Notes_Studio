$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\ojepp\projects\NoteSmith\Meeting_Notes_Studio"
$logPath = Join-Path $repoRoot "apps\desktop\src-tauri\target\release\tauri-build-signed.log"

if (Test-Path $logPath) {
  Remove-Item $logPath -Force
}

$env:Path = "C:\Program Files\nodejs;C:\Users\ojepp\.cargo\bin;" + $env:Path
$env:RUSTUP_HOME = "C:\Users\ojepp\.rustup"
$env:CARGO_HOME = "C:\Users\ojepp\.cargo"
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "C:\Users\ojepp\.tauri\notesmith-updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

Set-Location $repoRoot

& "C:\Users\ojepp\.cargo\bin\cargo.exe" -V *>&1 | Tee-Object -FilePath $logPath -Append
& "C:\Program Files\nodejs\npm.cmd" run tauri:build --workspace @notesmith/desktop *>&1 | Tee-Object -FilePath $logPath -Append
