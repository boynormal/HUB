# Hub — ศูนย์กลางการสื่อสาร

ศูนย์กลางการสื่อสารองค์กรของ เอส เจริญชัย กรุ๊ป พนักงานเข้าใช้งานด้วย LINE อ่านประกาศ
กดรับทราบ และติดตามงานที่ยังค้างได้จากมือถือ

Next.js 16 · React 19 · Prisma 6 · PostgreSQL · pg-boss · Tailwind CSS 4 · ฟอนต์ Anuphan

## เริ่มใช้งานบนเครื่องนักพัฒนา

```powershell
npm install
Copy-Item .env.example .env   # แล้วแก้ค่าให้ตรงกับเครื่อง
npx prisma migrate deploy
npm run db:seed
npm run dev
```

เปิด `http://localhost:3000` ครั้งแรกให้เข้าสู่ระบบด้วยรหัสผู้ดูแลระบบจาก
`BOOTSTRAP_ADMIN_EMPLOYEE_CODE` และ `BOOTSTRAP_ADMIN_PASSWORD` ใน `.env`

เปิด worker แยกอีกหนึ่งหน้าต่าง:

```powershell
npm run worker
```

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | เว็บโหมดพัฒนา |
| `npm run worker` | ตัวส่งแจ้งเตือนและเตือนตามกำหนด |
| `npm run typecheck` | ตรวจชนิดข้อมูล |
| `npm run lint` | ตรวจ ESLint |
| `npm run test` | ทดสอบหน่วย |
| `npm run db:migrate` | สร้าง migration ใหม่ตอนแก้ schema |
| `npm run db:deploy` | ใช้ migration ที่มีอยู่กับฐานข้อมูล |
| `npm run db:seed` | ใส่บทบาท สิทธิ์ หัวข้อ แท็ก และผู้ดูแลระบบเริ่มต้น |

## โครงสร้าง

```
prisma/        schema, migration, seed
src/app/       หน้าเว็บและ route handler
src/server/    ตรรกะฝั่งเซิร์ฟเวอร์ สิทธิ์ และคำสั่งฐานข้อมูล
src/components/ ส่วนประกอบหน้าจอ
worker/        กระบวนการ pg-boss แยกจากเว็บ
docs/          สถาปัตยกรรม ฐานข้อมูล API สิทธิ์ และการรันบนเครื่องบริษัท
tests/         ทดสอบหน่วยของฟังก์ชันล้วน
```

## เอกสาร

- [สถาปัตยกรรม](docs/communication-architecture.md)
- [ฐานข้อมูล](docs/communication-database.md)
- [API](docs/communication-api.md)
- [สิทธิ์การใช้งาน](docs/communication-permissions.md)
- [การรันบนเครื่องบริษัท](docs/communication-runtime.md)

## กติกาที่ระบบยึดไว้

- อ่านแล้วกับรับทราบแล้วเป็นสองสถานะ การอ่านไม่นับเป็นการรับทราบ
- กดรับทราบได้เฉพาะเจ้าตัว ไม่มีบทบาทใดกดแทนคนอื่นได้
- ประกาศเก็บเป็นกฎผู้รับ แล้วแปลงเป็นใบรับเมื่อเผยแพร่ ย้ายแผนกภายหลังไม่ดึงประกาศคืน
- ข้อมูลการสื่อสารใช้การลบแบบซ่อน ไม่ลบทิ้งจากฐานข้อมูล
- บันทึกการใช้งานเพิ่มได้เท่านั้น
- ตรวจสิทธิ์ที่เซิร์ฟเวอร์ทุกครั้ง ไม่เชื่อสิ่งที่หน้าจอส่งมา
