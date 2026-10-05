import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { loadMyTasks } from "@/server/feed";
import { requirePageActor, shellData } from "@/server/shell";

export default async function TasksPage() {
  const actor = await requirePageActor();
  const [shell, tasks] = await Promise.all([shellData(actor), loadMyTasks(actor)]);

  const sections = [
    { key: "overdue", title: "เกินกำหนด", cards: tasks.overdue, tone: "text-danger" },
    { key: "dueSoon", title: "ครบกำหนดใน 48 ชั่วโมง", cards: tasks.dueSoon, tone: "text-orange" },
    {
      key: "needsAck",
      title: "ต้องกดรับทราบ",
      cards: tasks.needsAcknowledgement,
      tone: "text-ink",
    },
    { key: "unread", title: "ยังไม่ได้อ่าน", cards: tasks.unread, tone: "text-muted" },
  ];

  const nothing =
    tasks.counts.needsAcknowledgement === 0 && tasks.counts.unread === 0;

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">งานของฉัน</h1>
      <p className="mt-1 text-sm text-muted">
        ค้างรับทราบ {tasks.counts.needsAcknowledgement} · ยังไม่อ่าน {tasks.counts.unread} ·
        เกินกำหนด {tasks.counts.overdue}
      </p>

      {nothing ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          ไม่มีงานค้าง อ่านครบแล้ว
        </p>
      ) : null}

      {sections.map((section) =>
        section.cards.length > 0 ? (
          <section key={section.key} className="mt-6" aria-labelledby={`tasks-${section.key}`}>
            <h2 id={`tasks-${section.key}`} className={`mb-2 text-sm font-semibold ${section.tone}`}>
              {section.title} ({section.cards.length})
            </h2>
            <div className="grid gap-3">
              {section.cards.map((card) => (
                <PostCard key={`${section.key}-${card.id}`} card={card} />
              ))}
            </div>
          </section>
        ) : null,
      )}
    </AppShell>
  );
}
