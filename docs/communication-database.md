# Communication Database

Database `hub` on the company PostgreSQL server. The app has no rights outside this database.

Schema source: [prisma/schema.prisma](../prisma/schema.prisma).

## Organisation tables

| Table | Notes |
| --- | --- |
| `companies` | One row for now |
| `branches` | Belongs to a company |
| `departments` | Optional `branch_id`. `manager_user_id` is the single person notified at a deadline. |
| `positions` | Job titles used for targeting |
| `users` | `employee_code` is unique. `line_user_id` is unique and null until LINE is linked. |
| `roles`, `permissions`, `role_permissions`, `user_roles` | Scope column: company, branch, department, topic, own |
| `groups`, `group_members` | Ad hoc recipient lists |

Employees never self-register. An admin creates the row with status `INVITED` and an invite code
hash; linking LINE sets `line_user_id` and flips the status to `ACTIVE`.

## Communication tables

| Table | Notes |
| --- | --- |
| `communication_topics` | `max_pinned` caps pinned posts per topic |
| `communication_tags`, `communication_post_tags` | Many to many |
| `communication_posts` | Soft delete through `deleted_at` |
| `communication_post_targets` | Target rules. Unique per post, type and id. |
| `communication_post_receipts` | `delivered_at`, `read_at`, `acknowledged_at` are separate columns |
| `communication_comments` | Self relation for threads, soft delete |
| `communication_attachments` | Stored file name plus the original name, size and MIME |
| `communication_notifications` | One row per channel, so a failed LINE push never hides the in-app copy |
| `communication_post_reminders` | The reminder plan for one post |
| `communication_audit_logs` | Append only |

## Rules the schema enforces

- Read and acknowledged are different columns. Read never implies acknowledged.
- `communication_post_receipts` is unique on `(post_id, user_id)`, so an employee cannot hold two
  receipts for the same post and nobody can acknowledge twice.
- Business records use `deleted_at` instead of a hard delete.
- Audit rows are only ever inserted.

## Indexes

Prisma covers the single and composite indexes from plan.md section 35, including
`(user_id, read_at)` and `(user_id, acknowledged_at)` on receipts.

The SQL migration `20260930_search_and_partial_indexes` adds what Prisma cannot express:

- `pg_trgm` extension plus GIN trigram indexes on `communication_posts.title` and `summary`
- a partial index for receipts that still need acknowledgement
- a partial index for unsent reminders

## Extensions

`pg_trgm` is required for Thai search. `pgcrypto` is optional. If the database owner does not allow
`CREATE EXTENSION`, `searchPostsBasic()` in [src/server/search.ts](../src/server/search.ts) keeps
search working with `ILIKE`.

## Backup

Back up database `hub` together with the attachment folder in `FILE_STORAGE_PATH`. A restore must
bring back posts, attachments and receipts from the same point in time.
