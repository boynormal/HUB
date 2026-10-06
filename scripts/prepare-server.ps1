# เตรียม Hub บนเครื่องเซิร์ฟเวอร์: ติดตั้งแพ็กเกจ ปรับฐานข้อมูล และบิลด์
# ใช้ครั้งแรก หรือหลังคัดลอกโปรเจกต์มาเครื่องนี้
# ตัวเลือก -Seed จะสร้างข้อมูลตั้งต้นและรหัสผู้ดูแลครั้งแรก อย่ารันซ้ำบนฐานข้อมูลที่มีพนักงานแล้ว
param(
    [switch]$Seed
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "hub-common.ps1")

Set-Location -LiteralPath $script:HubRoot
if (-not (Test-Path (Join-Path $script:HubRoot ".env"))) {
    throw "คัดลอก .env.example เป็น .env แล้วใส่ค่าจริงก่อนรันสคริปต์นี้"
}

$null = Get-HubNodePath
$folders = Initialize-HubFolders
Write-Host "โฟลเดอร์ไฟล์แนบ: $($folders.Storage)"
Write-Host "โฟลเดอร์บันทึก: $($folders.Logs)"

Write-Host "ติดตั้งแพ็กเกจ..."
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci ไม่สำเร็จ" }

Write-Host "ปรับฐานข้อมูล..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy ไม่สำเร็จ" }

if ($Seed) {
    Write-Host "สร้างข้อมูลตั้งต้น..."
    npm run db:seed
    if ($LASTEXITCODE -ne 0) { throw "db:seed ไม่สำเร็จ" }
}

Write-Host "บิลด์เว็บ..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build ไม่สำเร็จ" }

Write-Host "พร้อมแล้ว เปิดระบบด้วย scripts\run-server.cmd"
