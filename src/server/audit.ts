import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

export const AUDIT = {
  postCreated: "post_created",
  postUpdated: "post_updated",
  postPublished: "post_published",
  postScheduled: "post_scheduled",
  postArchived: "post_archived",
  postPinned: "post_pinned",
  postRead: "post_read",
  postAcknowledged: "post_acknowledged",
  commentCreated: "comment_created",
  commentDeleted: "comment_deleted",
  fileUploaded: "file_uploaded",
  fileDownloaded: "file_downloaded",
  recipientChanged: "recipient_changed",
  userCreated: "user_created",
  userUpdated: "user_updated",
  lineLinked: "line_linked",
  loginSucceeded: "login_succeeded",
  loginFailed: "login_failed",
  topicChanged: "topic_changed",
  tagChanged: "tag_changed",
  reminderSent: "reminder_sent",
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];

type AuditInput = {
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/// Append only. Nothing in the app updates or deletes these rows.
export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.communicationAuditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata,
    },
  });
}
