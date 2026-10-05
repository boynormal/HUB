# Communication Permissions

Keys live in `PERMISSIONS` in [src/server/rbac.ts](../src/server/rbac.ts). Seed data is in
[prisma/seed.ts](../prisma/seed.ts).

## Permission keys

```
communication.view              communication.manage_topics
communication.create            communication.manage_tags
communication.edit              communication.manage_recipients
communication.publish           communication.view_reports
communication.archive           communication.manage_training
communication.delete            communication.manage_polls
communication.moderate          communication.manage_settings
communication.manage_users
```

## Scopes

A grant carries a scope, and a `user_roles` row can pin that scope to one branch, department or
topic.

| Scope | Passes when |
| --- | --- |
| `COMPANY` | Always |
| `BRANCH` | The target branch matches the grant, or the actor's own branch when the grant has none |
| `DEPARTMENT` | Same rule for departments |
| `TOPIC` | The target topic matches the grant, or a topic the actor manages |
| `OWN` | The actor owns the record |

When a role grant and a permission both carry a scope, the narrower one wins.

## Roles

| Role | Permissions | Scope |
| --- | --- | --- |
| `employee` | view | company |
| `topic_manager` | view, create, edit, publish, archive, moderate, manage_recipients, view_reports | topic |
| `communication_admin` | everything except manage_settings and manage_users | company |
| `system_admin` | everything | company |

`isCommunicationAdmin()` short-circuits post checks for the two admin roles. Everyone else goes
through `hasScopedPermission()`.

## Rules that do not come from a permission

- Only the signed-in employee can acknowledge their own receipt. No role can acknowledge for
  someone else.
- Reading a post requires a receipt, or a management permission on that topic.
- Downloading an attachment requires access to its post. Every download writes an audit row.
- The deadline notice goes to the manager of the employee's department. With no manager, or no
  department, it goes to the Communication Admin instead.

## Fallback login

`/api/auth/admin` accepts an employee code and password for accounts that hold `system_admin`. It
exists so the first admin can set up topics and employees before the LINE channel is ready. Remove
`BOOTSTRAP_ADMIN_PASSWORD` from `.env` once a real admin account exists.
