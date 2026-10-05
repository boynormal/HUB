import { AppShell } from "@/components/app-shell";
import { TopicBrowser } from "@/components/topic-browser";
import { loadTopicSidebar } from "@/server/feed";
import { requirePageActor, shellData } from "@/server/shell";

export default async function TopicsPage() {
  const actor = await requirePageActor();
  const [shell, topics] = await Promise.all([shellData(actor), loadTopicSidebar(actor)]);

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">หัวข้อ</h1>
      <p className="mt-1 text-sm text-muted">เลือกหัวข้อเพื่อดูประกาศที่ส่งถึงคุณ</p>

      <TopicBrowser topics={topics} />
    </AppShell>
  );
}
