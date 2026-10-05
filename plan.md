# Communication Center — Full Function Build Plan

## 1. เป้าหมายระบบ

สร้าง Module `Communication Center` สำหรับ ERP ของบริษัท เพื่อใช้เป็นศูนย์กลางประกาศข่าวสาร การสื่อสารภายใน การติดตามการอ่าน/รับทราบ การแนบเอกสาร การสนทนา และการติดตามผล โดยออกแบบให้ใช้งานได้ทั้งระดับบริษัท สาขา แผนก ตำแหน่ง และกลุ่มพนักงาน

แนวคิดหลัก:

> "ประกาศแล้วต้องรู้ว่าใครเห็น ใครอ่าน ใครรับทราบ ใครยังค้าง และประกาศนั้นเกี่ยวข้องกับใคร"

ระบบต้องไม่เป็นเพียง Social Feed แบบ Facebook แต่เป็น `Communication + Accountability + Knowledge`.

---

# 2. หลักการพัฒนา

## 2.1 ใช้ระบบ ERP เดิมเป็นฐาน

ห้ามสร้างระบบผู้ใช้/พนักงาน/สาขา/แผนกซ้ำ หาก ERP มีข้อมูลเหล่านี้อยู่แล้ว

ให้ค้นหาและ reuse:
- users
- employees
- roles
- permissions
- branches
- departments
- positions
- customers/partners ตามความเหมาะสม

## 2.2 Reuse Design System

ใช้ UI/UX เดิมของ ERP:
- Navbar
- Sidebar
- Authentication
- Permission
- Modal
- Table
- Form
- Toast
- Notification
- Date/time
- File upload
- Theme

ไม่สร้าง UI framework ใหม่โดยไม่จำเป็น

## 2.3 Responsive

รองรับ:
- Desktop
- Tablet
- Mobile

Mobile ต้องสามารถ:
- อ่านประกาศ
- ยืนยันรับทราบ
- แสดงความคิดเห็น
- เปิดเอกสาร
- ดู Notification

ได้อย่างสมบูรณ์

---

# 3. Module Structure

```text
Communication Center
│
├── Feed
├── Announcements
├── Topics
├── Tags
├── My Tasks
│   ├── Unread
│   ├── Need Confirmation
│   └── Overdue
├── Notifications
├── Discussions
├── Polls
├── Documents
├── Knowledge
├── Training
└── Reports
```

---

# 4. User Roles

## 4.1 Employee

ทำได้:
- ดูประกาศที่มีสิทธิ์
- อ่าน
- ยืนยันรับทราบ
- แสดงความคิดเห็น
- ตอบ Poll
- ดาวน์โหลดไฟล์
- ค้นหา
- ดูประวัติของตัวเอง

## 4.2 Topic Manager

ทำได้:
- สร้าง/แก้ไขโพสต์ใน Topic ที่รับผิดชอบ
- ดูสถิติการอ่าน
- แจ้งเตือนผู้ที่ยังไม่รับทราบ
- จัดการ Discussion
- จัดการเอกสารของ Topic

## 4.3 Communication Admin

ทำได้ทั้งหมด:
- Topic
- Tag
- Post
- Recipient Group
- Notification
- Poll
- Report
- Moderation
- Archive
- Pin
- Announcement settings

## 4.4 System Admin

จัดการ:
- Permission
- System configuration
- Retention
- File policy
- Audit log

---

# 5. Core Data Model

## 5.1 communication_topics

```text
id
name
slug
description
icon
color
sort_order
is_active
manager_user_id
created_by
created_at
updated_at
```

ตัวอย่าง:
- บริษัท
- ขนส่ง
- คลัง
- ซ่อม
- ยาง
- รีไซเคิล
- Safety
- HR
- IT

---

# 6. Tags

## communication_tags

```text
id
name
slug
color
is_active
created_at
```

Post สามารถมีหลาย Tag

Relation:

```text
communication_posts
        │
        └── communication_post_tags
                    │
                    └── communication_tags
```

---

# 7. Posts

## communication_posts

```text
id
topic_id
post_type
title
summary
content
priority
status
author_id
published_at
scheduled_at
expires_at
is_pinned
is_featured
requires_read
requires_confirmation
confirmation_deadline
allow_comments
allow_reactions
created_at
updated_at
published_by
```

## post_type

```text
announcement
news
alert
procedure
training
event
question
document
instruction
poll
```

## priority

```text
normal
info
important
urgent
critical
```

## status

```text
draft
scheduled
published
expired
archived
cancelled
```

---

# 8. Recipient Targeting

ประกาศต้องเลือกผู้รับได้หลายระดับ

## communication_post_targets

```text
id
post_id
target_type
target_id
```

target_type:

```text
all
company
branch
department
position
role
user
group
```

ตัวอย่าง:

```text
@ทุกคน
@ฝ่ายขนส่ง
@โกดังพระประแดง
@หัวหน้าโกดัง
@ผู้จัดการ
```

ห้าม copy user ลงทุก post โดยไม่จำเป็น

ควรคำนวณ effective recipients จาก target rules

---

# 9. Read / Acknowledge

ต้องแยก:

```text
Delivered
Read
Acknowledged
```

## communication_post_receipts

```text
id
post_id
user_id
delivered_at
read_at
acknowledged_at
acknowledge_note
last_viewed_at
```

Status:

```text
UNREAD
READ
ACKNOWLEDGED
OVERDUE
```

หลักการ:

```text
ได้รับแจ้ง
    ↓
เปิดโพสต์
    ↓
Read
    ↓
กดยืนยัน
    ↓
Acknowledged
```

ห้ามถือว่า Read = Acknowledged

---

# 10. Confirmation

กรณีประกาศสำคัญ:

```text
requires_confirmation = true
```

ต้องมี:
- Deadline
- รายชื่อผู้ค้าง
- แจ้งเตือน
- Reminder
- Escalation

ตัวอย่าง:

```text
ประกาศ: กฎความปลอดภัยใหม่

ต้องรับทราบ: 85
รับทราบแล้ว: 79
ยังค้าง: 6
เกินกำหนด: 2
```

---

# 11. Reminder / Escalation

ระบบต้องสามารถตั้ง:

```text
Reminder ก่อน Deadline
Reminder เมื่อยังไม่อ่าน
Reminder เมื่ออ่านแต่ยังไม่ยืนยัน
Escalate หัวหน้า
```

ตัวอย่าง:

```text
T-24h → แจ้งเตือนพนักงาน
T-2h  → แจ้งเตือนซ้ำ
Deadline → แจ้งหัวหน้า
Overdue → แจ้ง Admin
```

ตั้งค่าได้ต่อ Post

---

# 12. Notifications

สร้าง Notification Center

ประเภท:

```text
new_post
mention
comment
reply
confirmation_required
confirmation_reminder
deadline
poll
training
system
```

ช่องทาง:

```text
in_app
email
LINE (future)
push (future)
```

ต้องมี notification inbox:

```text
ทั้งหมด
ยังไม่อ่าน
สำคัญ
ต้องรับทราบ
```

---

# 13. @Mention

รองรับ:

```text
@ชื่อพนักงาน
@แผนก
@สาขา
@กลุ่ม
```

เมื่อ Mention:
- สร้าง Notification
- Link กลับไปยัง Post/Comment
- เก็บ Audit

---

# 14. Comments / Discussions

## communication_comments

```text
id
post_id
parent_id
user_id
content
status
created_at
updated_at
deleted_at
```

รองรับ Thread:

```text
Post
 ├── Comment
 │    ├── Reply
 │    └── Reply
 └── Comment
```

ผู้สร้างโพสต์สามารถ:
- Pin comment
- Hide comment
- Close discussion

---

# 15. Reactions

รองรับ:

```text
like
acknowledge
helpful
question
```

ไม่ควรทำ Reaction เยอะเกินไป

---

# 16. Attachments

## communication_attachments

```text
id
post_id
comment_id
file_name
file_path
mime_type
file_size
version
uploaded_by
created_at
```

รองรับ:

```text
PDF
Excel
Word
Image
Video
ZIP ตาม policy
```

ต้องมี:
- file size limit
- extension validation
- MIME validation
- permission check
- download audit

---

# 17. Document Version

เอกสารที่เป็นคู่มือควรรองรับ Version:

```text
คู่มือการตรวจรถ

v1.0
v1.1
v2.0 ← Current
```

ต้องไม่ลบ version เก่าแบบ hard delete หากเป็นเอกสารที่มีผลทางธุรกิจ

---

# 18. Topics

Topic page:

```text
Topic Header

ชื่อ Topic
Description
Manager

Tabs:
Feed
Announcements
Documents
Knowledge
Training
Members
Statistics
```

---

# 19. Feed

หน้าแรก:

```text
Communication Center

[ Search ]

[ Topic ] [ Tag ] [ Priority ] [ Date ]

Pinned
Important
Latest
```

Card:

```text
🔴 สำคัญ

การตรวจรถก่อนออกงาน

#ขนส่ง #ความปลอดภัย

รายละเอียด...

👁 42/50
✅ 38/50
💬 4
📎 2

[อ่านประกาศ]
```

---

# 20. My Tasks

ต้องมีหน้าเฉพาะของผู้ใช้:

```text
สิ่งที่ต้องทำ

🔴 ต้องรับทราบ 3
👁 ยังไม่ได้อ่าน 2
⏰ ใกล้ครบกำหนด 1
❗ เกินกำหนด 1
```

นี่เป็นหนึ่งในหน้าหลักของระบบ

---

# 21. Search

ค้นหาจาก:

```text
title
content
topic
tag
author
branch
department
post_type
priority
date
attachment
```

ต้องรองรับ Full Text Search หาก DB รองรับ

Search result ต้องบอก:

```text
Topic
วันที่
ผู้โพสต์
ประเภท
สถานะของผู้ใช้
```

---

# 22. Poll

## communication_polls

```text
id
post_id
question
allow_multiple
anonymous
start_at
end_at
```

## communication_poll_options

```text
id
poll_id
label
sort_order
```

## communication_poll_votes

```text
id
poll_id
option_id
user_id
created_at
```

รองรับ:
- Single choice
- Multiple choice
- Anonymous
- Deadline
- Result permission

---

# 23. Training

ต่อยอดจาก Post

```text
Training Post
    ↓
Read
    ↓
Acknowledge
    ↓
Quiz
    ↓
Pass
    ↓
Training Record
```

## communication_training

```text
id
post_id
pass_score
attempt_limit
duration_minutes
```

## communication_training_questions

```text
id
training_id
question
question_type
score
sort_order
```

## communication_training_answers

```text
id
question_id
answer
is_correct
score
```

## communication_training_attempts

```text
id
training_id
user_id
score
status
started_at
completed_at
```

---

# 24. Knowledge Base

สร้าง Knowledge จาก Post ได้

```text
Draft
 ↓
Review
 ↓
Published
 ↓
Version
 ↓
Archive
```

ประเภท:

```text
คู่มือ
SOP
FAQ
วิธีใช้งาน ERP
Safety
Training
```

Knowledge ต้องค้นหาได้ง่ายกว่า Feed

---

# 25. Events

Post Type = Event

ข้อมูลเพิ่ม:

```text
event_start
event_end
location
capacity
registration_required
```

รองรับ:
- ลงทะเบียน
- ยกเลิก
- รายชื่อผู้เข้าร่วม
- Reminder

---

# 26. Announcement Composer

หน้าสร้างประกาศต้องมี Wizard หรือ Form ที่ชัดเจน

## Step 1

```text
ประเภท
Topic
หัวข้อ
ความสำคัญ
```

## Step 2

```text
รายละเอียด
รูปภาพ
เอกสาร
Video
Link
```

## Step 3

```text
ผู้รับ

บริษัท
สาขา
แผนก
ตำแหน่ง
กลุ่ม
บุคคล
```

## Step 4

```text
การรับทราบ

☐ ต้องอ่าน
☐ ต้องยืนยัน
Deadline
Reminder
Escalation
```

## Step 5

```text
Preview

Save Draft
Schedule
Publish
```

---

# 27. Pin / Feature

Post สามารถ:

```text
Pin
Feature
Archive
Expire
```

กำหนดจำนวน pinned post สูงสุดตาม Topic

---

# 28. Scheduled Post

รองรับ:

```text
Publish now
Schedule
Expire automatically
```

ต้องมี timezone:

```text
Asia/Bangkok
```

---

# 29. Audit Log

ทุก action สำคัญต้องบันทึก:

```text
post_created
post_updated
post_published
post_archived
post_read
post_acknowledged
comment_created
comment_deleted
file_downloaded
poll_voted
training_completed
recipient_changed
```

Audit:

```text
user
action
entity
entity_id
timestamp
IP (ถ้า policy อนุญาต)
metadata
```

ห้ามให้ user แก้ audit log

---

# 30. Reporting

## 30.1 Post Report

```text
Posts
Views
Reads
Acknowledged
Overdue
Comments
```

## 30.2 Branch Report

```text
พระประแดง 92%
โคราช 87%
สุราษฎร์ 95%
```

อย่าใช้คะแนนเพื่อประเมินพนักงานโดยอัตโนมัติ

ให้ใช้เพื่อค้นหางานค้างและการสื่อสารที่ตกหล่น

## 30.3 Employee Receipt

```text
พนักงาน
จำนวนประกาศ
อ่านแล้ว
รับทราบ
ค้าง
เกินกำหนด
```

## 30.4 Topic Report

```text
Topic
Posts
Readers
Acknowledgement
Comments
```

---

# 31. Dashboard

Executive:

```text
ประกาศเดือนนี้
ประกาศสำคัญ
ต้องรับทราบ
ยังค้าง
Overdue
Topics Active
```

Manager:

```text
ประกาศของแผนก
ผู้ที่ยังไม่รับทราบ
Deadline
Discussion
```

Employee:

```text
ยังไม่ได้อ่าน
ต้องรับทราบ
ประกาศล่าสุด
Topics ของฉัน
```

---

# 32. Permission Matrix

อย่างน้อย:

```text
communication.view
communication.create
communication.edit
communication.publish
communication.archive
communication.delete
communication.manage_topics
communication.manage_tags
communication.manage_recipients
communication.view_reports
communication.manage_training
communication.manage_polls
communication.moderate
communication.manage_settings
```

Permission ต้องรองรับ Scope:

```text
company
branch
department
topic
own
```

---

# 33. Security

ต้องทำ:

- Authentication reuse จาก ERP
- Authorization server-side
- Validate ownership
- Validate recipient scope
- File access permission
- XSS protection
- HTML sanitization
- CSRF ตาม architecture
- SQL injection protection
- Rate limit comments/mentions
- Audit critical actions
- Soft delete สำหรับ business records

ห้ามเชื่อ permission จาก frontend เพียงอย่างเดียว

---

# 34. Notification Architecture

แนะนำ:

```text
Post Published
      ↓
Resolve Recipients
      ↓
Create Notification Jobs
      ↓
Queue
      ↓
Notification Worker
      ├── In-App
      ├── Email
      ├── LINE (future)
      └── Push (future)
```

อย่าส่ง notification จำนวนมากใน HTTP request เดียว

---

# 35. Database Indexes

ต้องพิจารณา index:

```text
posts(topic_id)
posts(status)
posts(published_at)
posts(priority)
post_tags(tag_id)
post_receipts(user_id)
post_receipts(post_id)
post_receipts(user_id, read_at)
post_receipts(user_id, acknowledged_at)
comments(post_id)
comments(parent_id)
notifications(user_id, read_at)
```

สำหรับ PostgreSQL ให้พิจารณา:
- GIN / Full Text Search
- partial indexes
- composite indexes

ตาม query จริง

---

# 36. API Design

ถ้า ERP ใช้ REST:

```text
GET    /api/communication/feed
GET    /api/communication/posts/:id
POST   /api/communication/posts
PUT    /api/communication/posts/:id
DELETE /api/communication/posts/:id

POST   /api/communication/posts/:id/publish
POST   /api/communication/posts/:id/read
POST   /api/communication/posts/:id/acknowledge

GET    /api/communication/topics
POST   /api/communication/topics

GET    /api/communication/tags
POST   /api/communication/tags

GET    /api/communication/posts/:id/comments
POST   /api/communication/posts/:id/comments

GET    /api/communication/notifications
POST   /api/communication/notifications/:id/read

GET    /api/communication/reports/...
```

หาก ERP ใช้ GraphQL ให้ทำตาม architecture เดิมแทนการเพิ่ม REST ใหม่

---

# 37. Frontend Routes

ตัวอย่าง:

```text
/communication
/communication/feed
/communication/posts/:id
/communication/posts/create
/communication/posts/:id/edit
/communication/topics
/communication/topics/:slug
/communication/tags
/communication/my-tasks
/communication/notifications
/communication/documents
/communication/knowledge
/communication/training
/communication/reports
/communication/settings
```

ต้องตรวจสอบ routing convention ของ ERP ก่อนสร้างจริง

---

# 38. UI Components

สร้าง reusable components:

```text
CommunicationCard
AnnouncementBadge
PriorityBadge
TopicBadge
TagChip
ReadStatus
AcknowledgementStatus
RecipientSelector
PostComposer
PostEditor
AttachmentList
CommentThread
MentionInput
NotificationBell
NotificationPanel
ReceiptTable
PollCard
TrainingCard
DeadlineBadge
PostFilters
SearchBar
EmptyState
LoadingState
```

---

# 39. UX Rules

## Feed

ไม่ให้ Card สูงเกินไป

## Long content

แสดง Summary ก่อน
กดเข้าไปอ่านเต็ม

## Important

ใช้สีตาม Priority แต่ไม่ใช้สีมากเกินไป

## Mobile

ปุ่ม:

```text
อ่าน
รับทราบ
แสดงความคิดเห็น
```

ต้องกดง่าย

## Confirmation

ปุ่มต้องชัด:

```text
✓ ฉันอ่านและรับทราบ
```

และหลังยืนยัน:

```text
✓ รับทราบแล้ว
29 ก.ย. 2026 14:35
```

---

# 40. Home Feed Algorithm

เรียงโดย:

1. Critical
2. Required Confirmation
3. Pinned
4. Unread
5. Recent

แต่ต้องไม่ทำให้ผู้ใช้เห็นแต่ประกาศเก่า

ควรมี section:

```text
ต้องดำเนินการ
ประกาศสำคัญ
ล่าสุด
```

---

# 41. Performance

ต้องรองรับจำนวนข้อมูลมาก

ห้ามโหลด:
- Post ทั้งหมด
- Comment ทั้งหมด
- Receipt ทั้งหมด

ในหน้าเดียว

ใช้:
- pagination
- cursor pagination หากเหมาะสม
- lazy loading
- server-side filtering
- server-side search

---

# 42. Data Retention

กำหนด policy:

```text
Draft
Published
Expired
Archived
```

ไม่ hard delete business communication โดย default

ไฟล์เก่าอาจย้าย storage ตาม retention policy

---

# 43. Backup

ต้องรวม:
- DB
- Attachments
- Audit

การ restore ต้องทำให้ Post + Attachment + Receipt กลับมาสอดคล้องกัน

---

# 44. Testing

## Unit

ทดสอบ:
- permission
- recipient resolver
- status
- deadline
- acknowledgement
- notification

## Integration

ทดสอบ:

```text
Create Post
→ Publish
→ Resolve Recipient
→ Create Receipt
→ User Read
→ User Acknowledge
→ Reminder
```

## E2E

Scenario:

```text
Admin
สร้างประกาศ
เลือกโกดังพระประแดง
ต้องยืนยัน
Publish

Employee พระประแดง
ได้รับ notification
เปิดอ่าน
กดยืนยัน

Manager
เห็น 1/1 acknowledged
```

## Security

ทดสอบ:
- user แอบอ่าน post ที่ไม่มีสิทธิ์
- user แก้ post ของคนอื่น
- user ดาวน์โหลด attachment ที่ไม่มีสิทธิ์
- user acknowledge แทนคนอื่น
- unauthorized API

---

# 45. Seed Data

สร้างตัวอย่าง:

Topics:

```text
บริษัท
ขนส่ง
คลังสินค้า
ซ่อมบำรุง
ยาง
รีไซเคิล
ความปลอดภัย
HR
IT
```

Tags:

```text
#ด่วน
#ความปลอดภัย
#ERP
#ขนส่ง
#คลัง
#อบรม
#ประกาศ
#คู่มือ
```

Post Types:

```text
ประกาศ
ข่าวสาร
แจ้งเตือน
คู่มือ
อบรม
กิจกรรม
แบบสอบถาม
คำสั่งงาน
```

---

# 46. Implementation Phases

## Phase 0 — Discovery

ก่อน coding:

1. ตรวจ repository
2. ตรวจ frontend framework
3. ตรวจ backend
4. ตรวจ database
5. ตรวจ authentication
6. ตรวจ RBAC
7. ตรวจ file storage
8. ตรวจ notification
9. ตรวจ routing
10. ตรวจ design system

ห้ามเดา architecture

สร้าง:

```text
docs/communication-architecture.md
```

---

## Phase 1 — Database Foundation

ทำ:
- topics
- tags
- posts
- post_tags
- post_targets
- post_receipts
- comments
- attachments

Migration ต้อง rollback ได้

---

## Phase 2 — Core API

ทำ:
- Feed
- CRUD Post
- Publish
- Read
- Acknowledge
- Topics
- Tags
- Comments
- Attachments

---

## Phase 3 — Frontend Core

ทำ:

```text
/communication
/communication/feed
/communication/posts/:id
/communication/posts/create
/communication/my-tasks
```

---

## Phase 4 — Recipient Engine

ทำ:
- company
- branch
- department
- position
- role
- group
- individual

พร้อม effective recipient resolver

---

## Phase 5 — Notification

ทำ:
- in-app
- notification inbox
- mention
- reminder

---

## Phase 6 — Reporting

ทำ:
- Read report
- Acknowledge report
- Branch
- Department
- Employee
- Topic

---

## Phase 7 — Poll

ทำ:
- Poll
- Vote
- Result
- Deadline

---

## Phase 8 — Knowledge

ทำ:
- Knowledge
- Version
- Search
- SOP
- FAQ

---

## Phase 9 — Training

ทำ:
- Course/Post
- Quiz
- Attempt
- Score
- Training history

---

## Phase 10 — Advanced

ทำภายหลัง:

```text
LINE
Email
Push
Calendar
AI summary
AI search
AI translation
Recommendation
```

AI ต้องเป็น optional layer ไม่ผูกกับ Core

---

# 47. Cursor Development Workflow

ให้ Cursor ทำตามลำดับนี้

## Step 1

อ่าน repository ทั้ง architecture ที่เกี่ยวข้อง

ห้ามแก้ code

สร้าง:

```text
docs/communication-audit.md
```

## Step 2

สร้าง:

```text
docs/communication-architecture.md
docs/communication-database.md
docs/communication-api.md
docs/communication-permissions.md
```

## Step 3

ตรวจสอบ plan กับ architecture จริง

หาก plan ขัดกับระบบเดิม ให้ปรับ plan ก่อน coding

## Step 4

สร้าง migration

## Step 5

สร้าง backend/domain/service

## Step 6

สร้าง API

## Step 7

สร้าง frontend

## Step 8

สร้าง test

## Step 9

รัน lint/typecheck/test/build

## Step 10

ตรวจ security

## Step 11

สร้าง seed

## Step 12

ทำ final QA

---

# 48. Cursor Master Prompt

ใช้ Prompt นี้เป็นคำสั่งหลัก:

```text
You are implementing the Communication Center module inside an existing ERP.

IMPORTANT:
Do not assume the architecture.
First inspect the repository and existing patterns.

Goals:
Build a production-ready internal communication system with:
- Feed
- Topics
- Tags
- Announcements
- Recipient targeting
- Read status
- Explicit acknowledgement
- Comments and threaded discussions
- Mentions
- Notifications
- Attachments
- Polls
- Knowledge base
- Training/quiz
- Reports
- Audit logs
- RBAC
- Responsive UI

Rules:
1. Reuse existing authentication.
2. Reuse existing users, employees, branches, departments, roles and permissions.
3. Reuse existing design system.
4. Do not duplicate existing master data.
5. Do not introduce a new framework unless required.
6. Do not rewrite unrelated modules.
7. Follow existing coding conventions.
8. Server-side authorization is mandatory.
9. Never trust frontend permissions.
10. Use migrations for database changes.
11. Do not hard delete important business communication.
12. Validate file upload security.
13. Use pagination for lists.
14. Use server-side filtering/search.
15. Use background jobs for mass notifications where supported.
16. Read and acknowledgement are separate states.
17. All important actions must be auditable.
18. Write tests for business-critical logic.
19. Keep the UI consistent with the existing ERP.
20. Do not finish a phase until lint/typecheck/test/build pass.

Development process:
PHASE 0:
Audit repository and create:
docs/communication-audit.md

PHASE 1:
Create architecture documents before coding.

PHASE 2:
Implement database migration.

PHASE 3:
Implement domain/service layer.

PHASE 4:
Implement API.

PHASE 5:
Implement frontend core.

PHASE 6:
Implement notification and recipient engine.

PHASE 7:
Implement reporting.

PHASE 8:
Implement poll/knowledge/training.

For every phase:
- inspect existing code
- explain affected files
- implement
- run tests
- run lint
- run typecheck
- run build
- fix errors
- summarize changes
- do not modify unrelated files

Before each destructive or large refactor:
stop and inspect dependencies first.

If an existing ERP capability already solves a requirement:
reuse it instead of creating another implementation.

If architecture is unclear:
inspect more files rather than guessing.
```

---

# 49. Definition of Done

Module ถือว่าเสร็จเมื่อ:

```text
[ ] Login ใช้งานได้
[ ] Permission ถูกต้อง
[ ] Topic ใช้งานได้
[ ] Tag ใช้งานได้
[ ] Create Post
[ ] Edit Post
[ ] Publish
[ ] Schedule
[ ] Pin
[ ] Archive
[ ] Recipient targeting
[ ] Read tracking
[ ] Acknowledgement
[ ] Deadline
[ ] Reminder
[ ] Comments
[ ] Thread
[ ] Mention
[ ] Notification
[ ] Attachment
[ ] Search
[ ] Filter
[ ] Poll
[ ] Knowledge
[ ] Training
[ ] Reports
[ ] Audit
[ ] Mobile responsive
[ ] Security test
[ ] Unit test
[ ] Integration test
[ ] E2E test
[ ] Lint
[ ] Typecheck
[ ] Build
[ ] Migration rollback
[ ] Backup/restore consideration
```

---

# 50. MVP ที่ควรเปิดใช้งานจริงก่อน

แม้แผนนี้เป็น Full Function แต่ Production รุ่นแรกควรเปิด:

```text
1. Feed
2. Topic
3. Tag
4. Announcement
5. Recipient targeting
6. Read
7. Acknowledge
8. Comment
9. Attachment
10. Notification
11. Search
12. Report
13. Audit
```

จากนั้นจึงเปิด:

```text
Poll
Knowledge
Training
Event
LINE
Email
Push
AI
```

---

# 51. แนวคิดสำคัญของระบบ

ระบบนี้ไม่ควรเป็น:

```text
Facebook Clone
```

แต่ควรเป็น:

```text
                COMMUNICATION CENTER
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     INFORM           DISCUSS         ACCOUNT
        │                │                │
    Announcement      Comment          Read
    News              Thread           Confirm
    Document          Mention          Deadline
        │                │                │
        └────────────────┼────────────────┘
                         │
                    KNOWLEDGE
                         │
                 Training / SOP / FAQ
                         │
                       REPORT
```

เป้าหมายสุดท้าย:

> "ทุกประกาศต้องไปถึงคนที่เกี่ยวข้อง และผู้บริหารต้องตรวจสอบได้ว่าการสื่อสารนั้นไปถึงไหนแล้ว"

