param(
    [switch]$NoStartup,
    [switch]$WatchThemes
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$CliExe = Join-Path $RepoRoot 'target\release\agy-theme.exe'
$DaemonExe = Join-Path $RepoRoot 'target\release\agy-theme-daemon.exe'

if (-not (Test-Path $CliExe) -or -not (Test-Path $DaemonExe)) {
    $CargoCmd = Get-Command cargo -ErrorAction SilentlyContinue
    if (-not $CargoCmd) {
        Write-Error "Release binaries missing and 'cargo' not found in PATH. Install Rust or build first."
    }
    Write-Host "[install-win] Building Rust release binaries (cargo build --release)..."
    Push-Location $RepoRoot
    try {
        & $CargoCmd.Source build --release
        if ($LASTEXITCODE -ne 0) {
            Write-Error "cargo build --release failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

$ArgsList = @('--root', $RepoRoot, 'install')
if ($NoStartup) { $ArgsList += '--no-startup' }
if ($WatchThemes) { $ArgsList += '--watch-themes' }

& $CliExe @ArgsList
exit $LASTEXITCODE
