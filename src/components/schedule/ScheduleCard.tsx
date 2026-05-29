import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { ScheduledPost } from "../../stores/scheduleStore";
import { useScheduleStore } from "../../stores/scheduleStore";
import { cn } from "../../lib/utils";
import { formatScheduleDate } from "../../lib/scheduleDates";

const platformColors: Record<string, string> = {
  YouTube: "bg-red-500/15 text-red-400",
  Instagram: "bg-pink-500/15 text-pink-400",
  TikTok: "bg-sky-500/15 text-sky-400",
  Twitter: "bg-blue-500/15 text-blue-400",
  Facebook: "bg-blue-700/15 text-blue-400",
  LinkedIn: "bg-blue-600/15 text-blue-400",
  Snapchat: "bg-yellow-400/15 text-yellow-500",
};

export function ScheduleCardOverlay({ post }: { post: ScheduledPost }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-2xl rotate-1 cursor-grabbing backdrop-blur">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
        <p className="text-sm font-medium leading-snug">{post.title}</p>
      </div>
    </div>
  );
}

export function ScheduleCard({ post, onOpen }: { post: ScheduledPost; onOpen?: (id: string) => void }) {
  const {
    attributes, listeners,
    setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: post.id });

  const removePost = useScheduleStore((s) => s.removePost);

  const style = { transform: CSS.Transform.toString(transform), transition };
  const dateLabel = formatScheduleDate(post.scheduledDate, post.scheduledTime);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border border-border/60 bg-card/40 transition-all hover:border-border/80 hover:bg-card/60 cursor-pointer",
        isDragging && "opacity-30 scale-95"
      )}
      onClick={() => onOpen?.(post.id)}
    >
      {/* Preview image thumbnail */}
      {post.previewImageUrl && (
        <div className="overflow-hidden rounded-t-xl">
          <img
            src={post.previewImageUrl}
            alt=""
            className="h-24 w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div className={cn("p-3", post.previewImageUrl && "pt-2")}>
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0 touch-none cursor-grab text-muted-foreground/30 hover:text-muted-foreground/70 active:cursor-grabbing"
            tabIndex={-1}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{post.title}</p>

            {/* Platforms */}
            {post.platforms && post.platforms.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {post.platforms.map((p) => {
                  const cls = platformColors[p] ?? "bg-secondary/40 text-muted-foreground";
                  return (
                    <span key={p} className={cn("rounded-full px-2 py-0.5 font-micro text-[10px]", cls)}>
                      {p}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Date + time */}
            {dateLabel && (
              <div className="mt-1 flex items-center gap-1 font-micro text-[10px] text-muted-foreground">
                <span>📅</span>
                <span>{dateLabel}</span>
              </div>
            )}

            {/* Links indicator */}
            {post.links && post.links.length > 0 && (
              <div className="mt-1 font-micro text-[10px] text-muted-foreground/60">
                🔗 {post.links.length} {post.links.length === 1 ? "رابط" : "روابط"}
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-secondary/40 px-2 py-0.5 font-micro text-[10px] text-muted-foreground">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {post.notes && (
              <p className="mt-1 font-micro text-[11px] text-muted-foreground/70 line-clamp-2">
                {post.notes}
              </p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); removePost(post.id); }}
            className="shrink-0 text-muted-foreground/20 opacity-0 transition hover:text-destructive group-hover:opacity-100"
            aria-label="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
