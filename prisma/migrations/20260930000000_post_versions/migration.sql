-- Past and current editions of one post. The post row remains the edition shown in the feed.
CREATE TABLE "communication_post_versions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_post_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_post_versions_post_id_label_key" ON "communication_post_versions"("post_id", "label");
CREATE INDEX "communication_post_versions_post_id_idx" ON "communication_post_versions"("post_id");

ALTER TABLE "communication_post_versions" ADD CONSTRAINT "communication_post_versions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "communication_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "communication_attachments" ADD COLUMN "post_version_id" TEXT;
CREATE INDEX "communication_attachments_post_version_id_idx" ON "communication_attachments"("post_version_id");
ALTER TABLE "communication_attachments" ADD CONSTRAINT "communication_attachments_post_version_id_fkey" FOREIGN KEY ("post_version_id") REFERENCES "communication_post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
