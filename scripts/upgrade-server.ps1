# อัปเดต Hub บนเครื่องเซิร์ฟเวอร์ แล้วเปิดใหม่ด้วย scripts\run-server.cmd

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

Write-Host "อัปเดตเสร็จ ปิดหน้าต่างเว็บกับ HubWorker แล้วดับเบิลคลิก scripts\run-server.cmd"
