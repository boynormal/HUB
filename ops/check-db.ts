import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/// Reports who owns database `hub` and its `public` schema, and whether the app role may create
/// objects there. PostgreSQL 15 and later do not grant CREATE on `public` to everyone.
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      current_role: string;
      database_owner: string;
      schema_owner: string | null;
      schema_acl: string | null;
      can_create_schema: boolean;
      can_create_in_database: boolean;
    }>
  >`
    SELECT
      current_user AS current_role,
      pg_get_userbyid(d.datdba) AS database_owner,
      (SELECT pg_get_userbyid(n.nspowner) FROM pg_namespace n WHERE n.nspname = 'public') AS schema_owner,
      (SELECT n.nspacl::text FROM pg_namespace n WHERE n.nspname = 'public') AS schema_acl,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema,
      has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database
    FROM pg_database d
    WHERE d.datname = current_database()
  `;
  console.log(rows[0]);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
