# Shared paths for the Hub server scripts. Dot-source this file; do not run it alone.

$script:HubRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-HubNodePath {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "ไม่พบ Node.js ติดตั้ง Node.js แล้วเปิด PowerShell ใหม่"
    }
    return $command.Source
}

function Get-HubEnvValue([string]$Name) {
    $envFile = Join-Path $script:HubRoot ".env"
    if (-not (Test-Path $envFile)) {
        throw "ไม่พบไฟล์ .env ที่ $script:HubRoot"
    }
    foreach ($line in Get-Content -LiteralPath $envFile -Encoding UTF8) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
        $splitAt = $trimmed.IndexOf("=")
        if ($splitAt -lt 1) { continue }
        $key = $trimmed.Substring(0, $splitAt).Trim()
        if ($key -ne $Name) { continue }
        return $trimmed.Substring($splitAt + 1).Trim().Trim('"')
    }
    return ""
}

function Initialize-HubFolders {
    $storage = Get-HubEnvValue "FILE_STORAGE_PATH"
    if ([string]::IsNullOrWhiteSpace($storage)) {
        $storage = Join-Path $script:HubRoot "attachments"
    }
    $logDir = "D:\hub-data\logs"
    $backupDir = "D:\hub-data\backup"
    foreach ($dir in @($storage, $logDir, $backupDir)) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    return @{
        Storage = $storage
        Logs    = $logDir
        Backup  = $backupDir
    }
}
