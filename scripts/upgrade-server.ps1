# อัปเดต Hub บนเครื่องเซิร์ฟเวอร์ แล้วรีสตาร์ตบริการถ้าติดตั้งไว้แล้ว

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "hub-common.ps1")

Set-Location -LiteralPath $script:HubRoot
$null = Get-HubNodePath

Write-Host "ดึงโค้ดล่าสุด..."
git pull
if ($LASTEXITCODE -ne 0) { throw "git pull ไม่สำเร็จ" }

Write-Host "ติดตั้งแพ็กเกจ..."
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci ไม่สำเร็จ" }

Write-Host "ปรับฐานข้อมูล..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy ไม่สำเร็จ" }

Write-Host "บิลด์เว็บ..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build ไม่สำเร็จ" }

$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    foreach ($name in @("HubWeb", "HubWorker")) {
        & nssm status $name 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "รีสตาร์ต $name"
            & nssm restart $name
        }
    }
} else {
    Write-Host "ไม่พบ NSSM ถ้าเปิดเว็บเองอยู่ ให้ปิดแล้วรัน npm run start และ npm run worker ใหม่"
}

Write-Host "อัปเดตเสร็จ"
