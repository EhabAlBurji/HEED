import { useMemo, useState } from "react";
import { Clock, MapPin, Plus, Trash2, X } from "lucide-react";
import { useMeetingsStore, type Meeting } from "../../stores/meetingsStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { cn } from "../../lib/utils";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatMeetingDate(date: string, time: string | null): string {
  const [, m, d] = date.split("-");
  const month = MONTHS_AR[parseInt(m, 10) - 1];
  const dateStr = `${parseInt(d, 10)} ${month}`;
  return time ? `${dateStr} · ${time}` : dateStr;
}

function MeetingCard({ meeting, past }: { meeting: Meeting; past?: boolean }) {
  const deleteMeeting = useMeetingsStore((s) => s.deleteMeeting);
  return (
    <div className={cn(
      "group rounded-xl border border-border/40 bg-card/30 p-3 transition-colors hover:border-violet-500/30",
      past && "opacity-50"
    )}>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium leading-snug">{meeting.title}</p>
          <p className="font-micro text-[10px] text-muted-foreground">
            {formatMeetingDate(meeting.date, meeting.time)}
          </p>
          {meeting.location && (
            <p className="flex items-center gap-1 font-micro text-[10px] text-muted-foreground/60">
              <MapPin className="h-2.5 w-2.5" />
              {meeting.location}
            </p>
          )}
          {meeting.duration_minutes && (
            <p className="flex items-center gap-1 font-micro text-[10px] text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />
              {meeting.duration_minutes} دقيقة
            </p>
          )}
          {meeting.notes && (
            <p className="pt-0.5 font-micro text-[11px] text-muted-foreground/60 line-clamp-2">
              {meeting.notes}
            </p>
          )}
        </div>
        <button
          onClick={() => deleteMeeting(meeting.id)}
          className="shrink-0 text-muted-foreground/20 opacity-0 transition group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MeetingsPanel() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const allMeetings = useMeetingsStore((s) => s.meetings);
  const meetings = useMemo(
    () => allMeetings.filter((m) => (m.workspace_id ?? "personal") === activeWorkspaceId),
    [allMeetings, activeWorkspaceId]
  );
  const addMeeting = useMeetingsStore((s) => s.addMeeting);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekEndStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const sorted = [...meetings].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")
  );

  const todayList = sorted.filter((m) => m.date === todayStr);
  const weekList = sorted.filter((m) => m.date > todayStr && m.date <= weekEndStr);
  const laterList = sorted.filter((m) => m.date > weekEndStr);
  const pastList = sorted.filter((m) => m.date < todayStr).reverse();

  function resetForm() {
    setTitle(""); setDate(""); setTime(""); setDuration(""); setLocation(""); setNotes("");
    setShowForm(false);
  }

  function handleAdd() {
    if (!title.trim() || !date) return;
    addMeeting({
      title: title.trim(),
      date,
      time: time || null,
      duration_minutes: duration ? parseInt(duration, 10) : null,
      location: location.trim(),
      notes: notes.trim(),
      workspace_id: activeWorkspaceId,
    });
    resetForm();
  }

  const upcomingCount = todayList.length + weekList.length + laterList.length;

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-e border-border/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">الاجتماعات</h3>
          {upcomingCount > 0 && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-micro text-[10px] text-violet-400">
              {upcomingCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            showForm
              ? "bg-violet-500/20 text-violet-400"
              : "text-muted-foreground/50 hover:bg-secondary/60 hover:text-foreground"
          )}
          title="اجتماع جديد"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border-b border-border/40 px-4 py-3 space-y-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="عنوان الاجتماع *"
            className="w-full rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-violet-500/40 border border-border/30"
          />
          <div className="flex gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/40 border border-border/30"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-24 rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/40 border border-border/30"
            />
          </div>
          <div className="flex gap-1.5">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="المكان"
              className="flex-1 rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/40 border border-border/30 placeholder:text-muted-foreground/30"
            />
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="دقيقة"
              min="1"
              className="w-20 rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/40 border border-border/30 placeholder:text-muted-foreground/30"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات"
            rows={2}
            className="w-full resize-none rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/40 border border-border/30 placeholder:text-muted-foreground/30"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleAdd}
              disabled={!title.trim() || !date}
              className="flex-1 rounded-lg bg-violet-500/20 py-1.5 font-micro text-xs text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-40"
            >
              إضافة
            </button>
            <button
              onClick={resetForm}
              className="flex-1 rounded-lg bg-secondary/40 py-1.5 font-micro text-xs text-muted-foreground hover:bg-secondary/60"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {upcomingCount === 0 && pastList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <Clock className="h-5 w-5 text-violet-400/60" />
            </div>
            <p className="font-micro text-xs text-muted-foreground/40">لا توجد اجتماعات</p>
          </div>
        )}

        {todayList.length > 0 && (
          <section className="space-y-1.5">
            <p className="font-micro text-[10px] font-medium uppercase tracking-wider text-violet-400/70">اليوم</p>
            {todayList.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </section>
        )}

        {weekList.length > 0 && (
          <section className="space-y-1.5">
            <p className="font-micro text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">هذا الأسبوع</p>
            {weekList.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </section>
        )}

        {laterList.length > 0 && (
          <section className="space-y-1.5">
            <p className="font-micro text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">لاحقاً</p>
            {laterList.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </section>
        )}

        {pastList.length > 0 && (
          <section className="space-y-1.5">
            <p className="font-micro text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">سابقة</p>
            {pastList.slice(0, 5).map((m) => <MeetingCard key={m.id} meeting={m} past />)}
          </section>
        )}
      </div>
    </div>
  );
}
