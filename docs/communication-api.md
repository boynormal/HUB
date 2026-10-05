# Communication API

Route handlers under `src/app/api`. Hub is its own domain, so paths have no `/communication`
prefix. Every handler authenticates through `requireActor()` and repeats the permission check.

All responses are JSON. Errors use `{ "error": "ข้อความภาษาไทย" }` with a matching HTTP status.

## Authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/liff` | Body `{ accessToken }` from the LINE in-app browser |
| GET | `/api/auth/line/start` | Redirects to LINE Login for desktop browsers |
| GET | `/api/auth/line/callback` | LINE redirect target, sets the session cookie |
| POST | `/api/auth/link` | Body `{ employeeCode, inviteCode }`, links LINE to an employee |
| POST | `/api/auth/admin` | Body `{ employeeCode, password }`, System Admin fallback |
| POST | `/api/auth/logout` | Clears the session cookie |

## Feed and posts

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/feed` | Query: `topic`, `tag`, `priority`, `q`, `skip` |
| GET | `/api/posts/:id` | Post detail with the viewer's receipt |
| POST | `/api/posts` | Create a draft |
| PATCH | `/api/posts/:id` | Update a draft or a published post |
| DELETE | `/api/posts/:id` | Soft delete |
| POST | `/api/posts/:id/publish` | Resolves recipients, plans reminders, queues notifications |
| POST | `/api/posts/:id/schedule` | Body `{ scheduledAt }` |
| POST | `/api/posts/:id/read` | Marks read for the signed-in employee |
| POST | `/api/posts/:id/acknowledge` | Body `{ note? }`. Only for the signed-in employee. |
| POST | `/api/posts/:id/pin` | Body `{ isPinned }`, capped by the topic's `max_pinned` |
| POST | `/api/posts/:id/archive` | Moves to `ARCHIVED` |
| GET | `/api/posts/:id/receipts` | Who read and who still owes an acknowledgement |
| POST | `/api/posts/:id/remind` | Sends a reminder now to everyone still pending |

## Comments and attachments

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/posts/:id/comments` | Threaded list |
| POST | `/api/posts/:id/comments` | Body `{ content, parentId? }`. Rate limited. |
| DELETE | `/api/comments/:id` | Author or moderator, soft delete |
| POST | `/api/posts/:id/attachments` | Multipart upload, extension and MIME both checked |
| GET | `/api/attachments/:id` | Streams the file after an access check, writes an audit row |

## Directory and settings

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/topics`, POST `/api/topics` | Topic list and create |
| GET | `/api/tags`, POST `/api/tags` | Tag list and create |
| GET | `/api/targets` | Branches, departments, positions, roles, groups for the recipient step |
| GET | `/api/mentions?q=` | Mention lookup for the comment box |
| GET | `/api/users`, POST `/api/users` | Employee directory and create with an invite code |
| GET | `/api/search?q=` | Trigram search across delivered posts |

## Notifications and reports

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/notifications` | Inbox with `filter=all\|unread\|urgent\|confirmation` |
| POST | `/api/notifications/:id/read` | Marks one notification read |
| POST | `/api/notifications/read-all` | Marks the inbox read |
| GET | `/api/reports/posts` | Per post: recipients, read, acknowledged, overdue |
| GET | `/api/reports/branches` | Acknowledgement rate per branch |
| GET | `/api/reports/departments` | Acknowledgement rate per department |
| GET | `/api/reports/employees` | Per employee counts, filterable by branch or department |
| GET | `/api/reports/topics` | Per topic activity |
| GET | `/api/audit` | Audit log, System Admin only |

## Pagination

Lists take `skip` and `take` with a server-side maximum. Nothing returns every post, comment or
receipt in one response.
