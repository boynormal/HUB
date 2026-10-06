# Running Hub on the company computer

Two long-running processes and one tunnel:

| Process | Command | Purpose |
| --- | --- | --- |
| Web | `npm run start` | Next.js on `127.0.0.1:3110` |
| Worker | `npm run worker` | pg-boss consumer for notifications and reminders |
| Tunnel | `cloudflared tunnel run hub` | Publishes `hub.scharoenchai.cloud` |

## One-time database setup

The app owns database `hub` and nothing else. A role that can create databases runs this once:

```sql
CREATE DATABASE hub OWNER admin;
```

Then, connected to `hub` as a role allowed to install extensions:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

The second migration also tries to create the extension. If the role cannot install it, search
falls back to `ILIKE` automatically and nothing else changes.

## First deployment

```powershell
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build
```

`db:seed` prints the invite code for the bootstrap admin. Sign in at `/signin` with the admin
employee code and `BOOTSTRAP_ADMIN_PASSWORD`, create the real employees, then remove
`BOOTSTRAP_ADMIN_PASSWORD` from `.env`.

## Binding and exposure

Next.js listens on localhost only:

```powershell
$env:HOSTNAME = "127.0.0.1"
$env:PORT = "3110"
npm run start
```

Only `cloudflared` reaches it. The PostgreSQL port is never published; it stays on the company
network. Cloudflare terminates TLS, so `APP_ORIGIN` is `https://hub.scharoenchai.cloud` in
production and the session cookie is issued with `secure`.

`cloudflared` config (`%USERPROFILE%\.cloudflared\config.yml`):

```yaml
tunnel: hub
credentials-file: C:\Users\<user>\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: hub.scharoenchai.cloud
    service: http://127.0.0.1:3110
  - service: http_status:404
```

## Starting the app

Double-click `scripts\run-server.cmd`, or run it from the project folder. It opens the worker in a
window named HubWorker and keeps the web server in the current window on `127.0.0.1:3110`. Leave
both windows open. The Cloudflare tunnel is separate: `cloudflared service install` after
`config.yml` is in place.

If the worker is down, publishing still delivers notifications inside the request; reminders wait
until the worker returns.

## Health check

- `http://127.0.0.1:3110/api/me` returns `{"signedIn":false}` when the web process is healthy.
- `select count(*) from pgboss.job where state = 'created';` shows queue backlog.
- `select count(*) from communication_notifications where channel = 'LINE' and sent_at is null;`
  shows LINE pushes still waiting.

## Backup

Back up together, at the same point in time:

1. Database `hub`: `pg_dump -U admin -h localhost -Fc hub > D:\hub-data\backup\hub-YYYYMMDD.dump`
2. The attachment folder in `FILE_STORAGE_PATH`

A database restored without its attachments leaves posts pointing at missing files. Keep both in
the same nightly task and test a restore into a scratch database twice a year.

## Upgrades

```powershell
git pull
npm ci
npx prisma migrate deploy
npm run build
```

Then close the web and HubWorker windows and start `scripts\run-server.cmd` again. Run `npm run test`
and `npm run typecheck` before replacing a running server.
