import { PrismaClient, type PermissionScope } from "@prisma/client";
import { generateInviteCode, hashSecret } from "../src/server/auth/password";

const prisma = new PrismaClient();

const PERMISSION_LIST: Array<{ key: string; label: string }> = [
  { key: "communication.view", label: "ดูประกาศ" },
  { key: "communication.create", label: "สร้างประกาศ" },
  { key: "communication.edit", label: "แก้ไขประกาศ" },
  { key: "communication.publish", label: "เผยแพร่ประกาศ" },
  { key: "communication.archive", label: "เก็บเข้าคลัง" },
  { key: "communication.delete", label: "ลบประกาศ" },
  { key: "communication.moderate", label: "ดูแลความคิดเห็น" },
  { key: "communication.manage_topics", label: "จัดการหัวข้อ" },
  { key: "communication.manage_tags", label: "จัดการแท็ก" },
  { key: "communication.manage_recipients", label: "จัดการผู้รับ" },
  { key: "communication.view_reports", label: "ดูรายงาน" },
  { key: "communication.manage_training", label: "จัดการอบรม" },
  { key: "communication.manage_polls", label: "จัดการแบบสอบถาม" },
  { key: "communication.manage_settings", label: "ตั้งค่าระบบ" },
  { key: "communication.manage_users", label: "จัดการผู้ใช้" },
];

type RoleSeed = {
  key: string;
  name: string;
  description: string;
  scope: PermissionScope;
  permissions: string[];
  permissionScopes?: Partial<Record<string, PermissionScope>>;
};

const ALL_KEYS = PERMISSION_LIST.map((permission) => permission.key);

const ROLE_LIST: RoleSeed[] = [
  {
    key: "employee",
    name: "พนักงาน",
    description: "อ่านประกาศที่ส่งถึงตัวเอง และกดรับทราบ",
    scope: "COMPANY",
    permissions: ["communication.view"],
  },
  {
    key: "lead",
    name: "หัวหน้า",
    description: "โพสต์และเผยแพร่ประกาศของตัวเอง ไม่เห็นการตั้งค่า",
    scope: "COMPANY",
    permissions: [
      "communication.view",
      "communication.create",
      "communication.edit",
      "communication.publish",
      "communication.manage_recipients",
    ],
    permissionScopes: {
      "communication.edit": "OWN",
      "communication.publish": "OWN",
    },
  },
  {
    key: "topic_manager",
    name: "ผู้ดูแลหัวข้อ",
    description: "สร้างและเผยแพร่ประกาศในหัวข้อที่ดูแล",
    scope: "TOPIC",
    permissions: [
      "communication.view",
      "communication.create",
      "communication.edit",
      "communication.publish",
      "communication.archive",
      "communication.moderate",
      "communication.manage_recipients",
      "communication.view_reports",
    ],
  },
  {
    key: "communication_admin",
    name: "ผู้ดูแลการสื่อสาร",
    description: "ดูแลประกาศทั้งองค์กร",
    scope: "COMPANY",
    permissions: ALL_KEYS.filter(
      (key) => key !== "communication.manage_settings" && key !== "communication.manage_users",
    ),
  },
  {
    key: "system_admin",
    name: "ผู้ดูแลระบบ",
    description: "สิทธิ์ทั้งหมด รวมการตั้งค่าและผู้ใช้",
    scope: "COMPANY",
    permissions: ALL_KEYS,
  },
];

const TOPICS = [
  { name: "บริษัท", slug: "company", icon: "building", color: "#1D4E89" },
  { name: "ขนส่ง", slug: "logistics", icon: "truck", color: "#0F766E" },
  { name: "คลังสินค้า", slug: "warehouse", icon: "package", color: "#7C3AED" },
  { name: "ซ่อมบำรุง", slug: "maintenance", icon: "wrench", color: "#B45309" },
  { name: "ยาง", slug: "tyre", icon: "circle", color: "#334155" },
  { name: "รีไซเคิล", slug: "recycle", icon: "recycle", color: "#15803D" },
  { name: "ความปลอดภัย", slug: "safety", icon: "shield", color: "#B91C1C" },
  { name: "HR", slug: "hr", icon: "users", color: "#BE185D" },
  { name: "IT", slug: "it", icon: "monitor", color: "#0369A1" },
];

const TAGS = [
  { name: "ด่วน", slug: "urgent", color: "#B91C1C" },
  { name: "ความปลอดภัย", slug: "safety", color: "#C2410C" },
  { name: "ERP", slug: "erp", color: "#1D4E89" },
  { name: "ขนส่ง", slug: "logistics", color: "#0F766E" },
  { name: "คลัง", slug: "warehouse", color: "#7C3AED" },
  { name: "อบรม", slug: "training", color: "#15803D" },
  { name: "ประกาศ", slug: "announcement", color: "#334155" },
  { name: "คู่มือ", slug: "handbook", color: "#B45309" },
];

const BRANCHES = [
  { name: "สำนักงานใหญ่", code: "HQ" },
  { name: "สาขาขนส่ง", code: "LOG" },
  { name: "สาขาคลังสินค้า", code: "WH" },
];

const DEPARTMENTS = [
  { name: "บริหาร", code: "MGT" },
  { name: "บุคคล", code: "HR" },
  { name: "บัญชีและการเงิน", code: "FIN" },
  { name: "ขนส่ง", code: "LOGI" },
  { name: "คลังสินค้า", code: "WHSE" },
  { name: "ซ่อมบำรุง", code: "MNT" },
  { name: "ความปลอดภัย", code: "SAFE" },
  { name: "เทคโนโลยีสารสนเทศ", code: "IT" },
];

const POSITIONS = [
  { name: "พนักงาน", code: "STAFF" },
  { name: "หัวหน้างาน", code: "SUPV" },
  { name: "ผู้จัดการแผนก", code: "MGR" },
  { name: "ผู้บริหาร", code: "EXEC" },
];

async function main() {
  const company = await prisma.company.upsert({
    where: { code: "SJC" },
    update: { name: "ส.เจริญชัย รีไซเคิล" },
    create: { code: "SJC", name: "ส.เจริญชัย รีไซเคิล" },
  });

  for (const permission of PERMISSION_LIST) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { label: permission.label },
      create: permission,
    });
  }

  for (const roleSeed of ROLE_LIST) {
    const role = await prisma.role.upsert({
      where: { key: roleSeed.key },
      update: { name: roleSeed.name, description: roleSeed.description, isSystem: true },
      create: {
        key: roleSeed.key,
        name: roleSeed.name,
        description: roleSeed.description,
        isSystem: true,
      },
    });
    const permissions = await prisma.permission.findMany({
      where: { key: { in: roleSeed.permissions } },
      select: { id: true, key: true },
    });
    // Re-seeding must not leave a role holding a permission that was removed from this list.
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: permissions.map((p) => p.id) } },
    });
    for (const permission of permissions) {
      const scope = roleSeed.permissionScopes?.[permission.key] ?? roleSeed.scope;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: { scope },
        create: { roleId: role.id, permissionId: permission.id, scope },
      });
    }
  }

  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      update: { name: branch.name },
      create: { ...branch, companyId: company.id },
    });
  }

  for (const department of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: { name: department.name },
      create: { ...department, companyId: company.id },
    });
  }

  for (const position of POSITIONS) {
    await prisma.position.upsert({
      where: { code: position.code },
      update: { name: position.name },
      create: { ...position, companyId: company.id },
    });
  }

  for (const [index, topic] of TOPICS.entries()) {
    await prisma.communicationTopic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name, icon: topic.icon, color: topic.color, sortOrder: index },
      create: { ...topic, sortOrder: index },
    });
  }

  for (const tag of TAGS) {
    await prisma.communicationTag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name, color: tag.color },
      create: tag,
    });
  }

  await seedBootstrapAdmin(company.id);

  const counts = {
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    branches: await prisma.branch.count(),
    departments: await prisma.department.count(),
    positions: await prisma.position.count(),
    topics: await prisma.communicationTopic.count(),
    tags: await prisma.communicationTag.count(),
    users: await prisma.user.count(),
  };
  console.log("seed complete", counts);
}

/// The first System Admin can sign in with a password so topics and employees can be set up
/// before the LINE channel exists. Everyone else links LINE instead.
async function seedBootstrapAdmin(companyId: string) {
  const employeeCode = process.env.BOOTSTRAP_ADMIN_CODE ?? process.env.BOOTSTRAP_ADMIN_EMPLOYEE_CODE;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!employeeCode || !password) {
    console.log("ข้าม bootstrap admin: ยังไม่ได้ตั้ง BOOTSTRAP_ADMIN_EMPLOYEE_CODE หรือ BOOTSTRAP_ADMIN_PASSWORD");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { employeeCode } });
  const inviteCode = generateInviteCode();
  const admin = await prisma.user.upsert({
    where: { employeeCode },
    update: { status: "ACTIVE", passwordHash: await hashSecret(password) },
    create: {
      employeeCode,
      fullName: "ผู้ดูแลระบบ",
      companyId,
      status: "ACTIVE",
      passwordHash: await hashSecret(password),
      inviteCodeHash: await hashSecret(inviteCode),
    },
  });

  const systemAdminRole = await prisma.role.findUniqueOrThrow({ where: { key: "system_admin" } });
  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { key: "employee" } });
  for (const role of [systemAdminRole, employeeRole]) {
    // Postgres treats NULLs as distinct in a unique index, so the grant is matched by query
    // rather than by upsert on the composite key.
    const existingGrant = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: role.id, scope: "COMPANY" },
      select: { id: true },
    });
    if (!existingGrant) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: role.id, scope: "COMPANY" },
      });
    }
  }

  if (!existing) {
    console.log(`สร้างผู้ดูแลระบบ ${employeeCode} แล้ว รหัสเชิญสำหรับผูก LINE: ${inviteCode}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
