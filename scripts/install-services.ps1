# ติดตั้ง Hub เป็น Windows service ให้กลับมาเองหลังรีสตาร์ตเครื่อง
# รัน PowerShell แบบ Run as administrator
# ต้องรัน scripts\prepare-server.ps1 ให้ผ่านก่อน

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "hub-common.ps1")

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "เปิด PowerShell แบบ Run as administrator แล้วรันสคริปต์นี้อีกครั้ง"
}

$folders = Initialize-HubFolders
$node = Get-HubNodePath
$next = Join-Path $script:HubRoot "node_modules\next\dist\bin\next"
$tsx = Join-Path $script:HubRoot "node_modules\tsx\dist\cli.mjs"
if (-not (Test-Path $next)) { throw "ไม่พบ Next.js รัน scripts\prepare-server.ps1 ก่อน" }
if (-not (Test-Path $tsx)) { throw "ไม่พบ tsx รัน scripts\prepare-server.ps1 ก่อน" }

$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssm) {
    throw "ไม่พบ NSSM ติดตั้งจาก https://nssm.cc แล้วใส่ nssm.exe ไว้ใน PATH"
}

function Install-HubService([string]$Name, [string]$Arguments, [string]$LogFile) {
    & nssm status $Name 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "มีบริการ $Name อยู่แล้ว จะปรับค่าให้ตรงกับเครื่องนี้"
    } else {
        & nssm install $Name $node $Arguments
        if ($LASTEXITCODE -ne 0) { throw "ติดตั้ง $Name ไม่สำเร็จ" }
    }
    & nssm set $Name AppParameters $Arguments
    & nssm set $Name AppDirectory $script:HubRoot
    & nssm set $Name AppStdout $LogFile
    & nssm set $Name AppStderr $LogFile
    & nssm set $Name AppRotateFiles 1
    & nssm set $Name AppRotateBytes 10485760
    & nssm set $Name Start SERVICE_AUTO_START
}

$webArgs = "`"$next`" start"
$workerArgs = "`"$tsx`" `"$(Join-Path $script:HubRoot "worker\index.ts")`""
Install-HubService "HubWeb" $webArgs (Join-Path $folders.Logs "web.log")
& nssm set HubWeb AppEnvironmentExtra "HOSTNAME=127.0.0.1" "NODE_ENV=production" "PORT=3110"

Install-HubService "HubWorker" $workerArgs (Join-Path $folders.Logs "worker.log")
& nssm set HubWorker AppEnvironmentExtra "NODE_ENV=production"

Write-Host "เริ่มบริการเว็บและตัวแจ้งเตือน..."
& nssm start HubWeb
& nssm start HubWorker

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "ยังไม่พบ cloudflared ติดตั้งแล้วค่อยรัน: cloudflared service install"
    Write-Host "ตัวอย่างค่าอุโมงค์อยู่ที่ scripts\cloudflared.config.example.yml"
} else {
    Write-Host "ติดตั้งบริการ cloudflared ถ้ายังไม่ได้ติดตั้ง ให้รัน cloudflared service install เองหลังตั้ง config.yml"
}

Write-Host "ตรวจเว็บที่ http://127.0.0.1:3110/api/me ต้องได้ signedIn false"
