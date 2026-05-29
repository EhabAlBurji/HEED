import { useEffect, useRef, useState } from "react";
import {
  CalendarDays, ExternalLink, Image, Link2, Plus, Save, Trash2, X,
} from "lucide-react";
import { useScheduleStore } from "../../stores/scheduleStore";
import { cn } from "../../lib/utils";
import {
  MONTHS_AR,
  QUICK_TIMES,
  daysInMonth,
  formatScheduleDate,
  quickScheduleDates,
  scheduleDateFromParts,
  splitScheduleDate,
} from "../../lib/scheduleDates";

const PLATFORMS = ["YouTube", "Instagram", "TikTok", "Twitter", "Facebook", "LinkedIn", "Snapchat", "Other"];

const platformColors: Record<string, string> = {
  YouTube: "bg-red-500/15 text-red-400 border-red-500/30",
  Instagram: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  TikTok: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  Twitter: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Facebook: "bg-blue-700/15 text-blue-400 border-blue-700/30",
  LinkedIn: "bg-blue-600/15 text-blue-400 border-blue-600/30",
  Snapchat: "bg-yellow-400/15 text-yellow-500 border-yellow-400/30",
};

interface Props {
  postId: string | null;
  onClose: () => void;
}

export function SchedulePostDrawer({ postId, onClose }: Props) {
  const posts = useScheduleStore((s) => s.posts);
  const updatePost = useScheduleStore((s) => s.updatePost);
  const removePost = useScheduleStore((s) => s.removePost);

  const post = posts.find((p) => p.id === postId) ?? null;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [imageError, setImageError] = useState(false);

  const prevPostId = useRef<string | null>(null);

  useEffect(() => {
    if (!post || post.id === prevPostId.current) return;
    prevPostId.current = post.id;
    setTitle(post.title);
    setNotes(post.notes ?? "");
    setSelectedPlatforms(post.platforms ?? []);
    if (post.scheduledDate) {
      const parts = splitScheduleDate(post.scheduledDate);
      setMonth(parts.month);
      setDay(parts.day);
    } else {
      setMonth("");
      setDay("");
    }
    setTime(post.scheduledTime ?? "");
    setPreviewImageUrl(post.previewImageUrl ?? "");
    setLinks(post.links ?? []);
    setImageError(false);
  }, [post]);

  if (!postId) return null;

  function save() {
    if (!post) return;
    const scheduledDate = scheduleDateFromParts(month, day);
    updatePost(post.id, {
      title: title.trim() || post.title,
      notes,
      platforms: selectedPlatforms,
      scheduledDate,
      scheduledTime: time || null,
      previewImageUrl: previewImageUrl.trim() || null,
      links,
    });
    onClose();
  }

  function handleDelete() {
    if (!post) return;
    removePost(post.id);
    onClose();
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function addLink() {
    const url = newLinkUrl.trim();
    if (!url) return;
    setLinks((prev) => [...prev, { label: newLinkLabel.trim() || url, url }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  function pickDate(nextMonth: string, nextDay: string) {
    setMonth(nextMonth);
    setDay(nextDay);
  }

  const maxDay = month ? daysInMonth(parseInt(month)) : 31;
  const isOpen = !!postId;
  const selectedDate = scheduleDateFromParts(month, day);
  const dateLabel = formatScheduleDate(selectedDate, time || null);
  const quickDates = quickScheduleDates();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 bottom-0 end-0 z-50 flex w-[420px] flex-col border-s border-border/60 bg-card shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <h2 className="font-display text-base font-semibold">تفاصيل المنشور</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground/40 hover:bg-secondary/60 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-micro text-[11px] text-muted-foreground">العنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl bg-background/40 px-3 py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-primary/40 border border-border/30"
            />
          </div>

          {/* Preview image */}
          <div className="space-y-2">
            <label className="font-micro text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Image className="h-3 w-3" /> صورة البريفيو
            </label>
            <input
              value={previewImageUrl}
              onChange={(e) => { setPreviewImageUrl(e.target.value); setImageError(false); }}
              placeholder="https://... رابط الصورة"
              className="w-full rounded-xl bg-background/40 px-3 py-2 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-border/30 placeholder:text-muted-foreground/30"
              dir="ltr"
            />
            {previewImageUrl && !imageError && (
              <div className="overflow-hidden rounded-xl border border-border/40 bg-secondary/20">
                <img
                  src={previewImageUrl}
                  alt="preview"
                  onError={() => setImageError(true)}
                  className="w-full max-h-52 object-cover"
                />
              </div>
            )}
            {previewImageUrl && imageError && (
              <p className="font-micro text-[10px] text-destructive/60">تعذّر تحميل الصورة</p>
            )}
          </div>

          {/* Platforms */}
          <div className="space-y-2">
            <label className="font-micro text-[11px] text-muted-foreground">المنصات</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const active = selectedPlatforms.includes(p);
                const colorCls = platformColors[p] ?? "bg-secondary/30 text-muted-foreground border-border/30";
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-micro text-[10px] border transition-colors",
                      active ? colorCls : "bg-secondary/20 text-muted-foreground/50 border-border/20 hover:border-border/50"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + time */}
          <div className="space-y-2">
            <label className="font-micro text-[11px] text-muted-foreground">التاريخ والوقت</label>
            <div className="grid grid-cols-3 gap-1.5">
              {quickDates.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => pickDate(option.month, option.day)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 font-micro text-[11px] transition-colors",
                    selectedDate === option.value
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border/30 bg-background/25 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={month}
                onChange={(e) => { setMonth(e.target.value); setDay(""); }}
                className="flex-1 rounded-xl bg-background/40 px-3 py-2 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-border/30"
              >
                <option value="">الشهر</option>
                {MONTHS_AR.map((m, i) => (
                  <option key={i} value={String(i + 1)}>{m}</option>
                ))}
              </select>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                disabled={!month}
                className="w-20 rounded-xl bg-background/40 px-3 py-2 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-border/30 disabled:opacity-40"
              >
                <option value="">يوم</option>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-28 rounded-xl bg-background/40 px-3 py-2 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-border/30"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIMES.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTime(slot)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-micro text-[10px] transition-colors",
                    time === slot
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border/25 bg-background/20 text-muted-foreground/70 hover:border-primary/30 hover:text-foreground"
                  )}
                  dir="ltr"
                >
                  {slot}
                </button>
              ))}
            </div>
            {dateLabel && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/8 px-3 py-2 font-micro text-xs text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>تاريخ النشر: {dateLabel}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="font-micro text-[11px] text-muted-foreground">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="أضف ملاحظات..."
              className="w-full resize-none rounded-xl bg-background/40 px-3 py-2 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-border/30 placeholder:text-muted-foreground/30"
            />
          </div>

          {/* Links */}
          <div className="space-y-2">
            <label className="font-micro text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Link2 className="h-3 w-3" /> الروابط
            </label>

            {links.length > 0 && (
              <div className="space-y-1.5">
                {links.map((lnk, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/20 px-3 py-2">
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <a
                        href={lnk.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-micro text-[11px] text-primary hover:underline"
                        dir="ltr"
                      >
                        {lnk.label}
                      </a>
                    </div>
                    <button
                      onClick={() => removeLink(idx)}
                      className="shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add link form */}
            <div className="rounded-xl border border-dashed border-border/30 p-3 space-y-2">
              <input
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                placeholder="الاسم (اختياري)"
                className="w-full rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 border border-border/20 placeholder:text-muted-foreground/30"
              />
              <div className="flex gap-1.5">
                <input
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="https://..."
                  dir="ltr"
                  className="flex-1 rounded-lg bg-background/40 px-2.5 py-1.5 font-micro text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 border border-border/20 placeholder:text-muted-foreground/30"
                />
                <button
                  onClick={addLink}
                  className="rounded-lg bg-primary/15 px-2.5 py-1.5 font-micro text-xs text-primary hover:bg-primary/25 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-5 py-4">
          <button
            onClick={save}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/20 py-2.5 font-micro text-sm text-primary hover:bg-primary/30 transition-colors"
          >
            <Save className="h-4 w-4" />
            حفظ التغييرات
          </button>
        </div>
      </div>
    </>
  );
}
