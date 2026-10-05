# Communication Architecture

Hub is a standalone Next.js application. There is no ERP to reuse, so this app owns employees,
branches, departments, positions, roles and permissions.

## Runtime

```
Employee in LINE ─┐
                  ├─► Cloudflare ─► cloudflared (company PC) ─► Next.js (127.0.0.1:3110)
Desktop browser ──┘                                                   │
                                                                      ├─► PostgreSQL database `hub`
                                                                      ├─► attachments on local disk
                                                                      └─► LINE Login + Messaging API

pg-boss worker (separate process) ─► PostgreSQL schema `pgboss` ─► LINE push
```

Next.js binds to localhost only. `cloudflared` makes the outbound connection and maps
`hub.scharoenchai.cloud` to the app port. The PostgreSQL port never leaves the company network.

## Layers

| Path | Job |
| --- | --- |
| `src/app` | Routes, pages and route handlers |
| `src/server` | Domain logic, access control, queries. Server only. |
| `src/components` | UI components |
| `prisma` | Schema, migrations, seed |
| `worker` | pg-boss consumer for notifications and reminders |

`src/server` modules never import from `src/components`. Route handlers and server components call
into `src/server`; the browser never talks to the database.

## Access control

Every request loads the actor fresh with `loadActor()` in [src/server/rbac.ts](../src/server/rbac.ts).
A suspended account or a changed role takes effect on the next request. The UI hides actions the
actor cannot take, and each route handler repeats the same check server side.

## Delivery model

1. A post stores target rules, not a copy of the employee list.
2. Publishing resolves the rules into `communication_post_receipts` rows, one per employee.
3. After publishing, receipts are the source of truth, so a later transfer between branches never
   removes an announcement that was already delivered.
4. Notification fan-out happens in the worker. The publish request only enqueues a job.

## Queue

pg-boss owns schema `pgboss` in the same database. Prisma does not manage those tables. If the
queue cannot start, `publishPost` falls back to sending notifications inside the request so a
missing worker never loses an announcement.

## Time

All timestamps are stored in UTC. Display formatting uses `Asia/Bangkok` through
[src/server/time.ts](../src/server/time.ts).
