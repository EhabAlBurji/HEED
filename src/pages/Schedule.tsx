import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CalendarDays } from "lucide-react";
import {
  useScheduleStore,
  type ScheduleColumn,
  type ScheduledPost,
} from "../stores/scheduleStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { ScheduleColumn as ScheduleCol } from "../components/schedule/ScheduleColumn";
import { ScheduleCardOverlay } from "../components/schedule/ScheduleCard";
import { SchedulePostDrawer } from "../components/schedule/SchedulePostDrawer";

const COLUMNS: ScheduleColumn[] = ["content", "this_week", "today", "published"];

export default function Schedule() {
  const allPosts = useScheduleStore((s) => s.posts);
  const updatePost = useScheduleStore((s) => s.updatePost);
  const movePost = useScheduleStore((s) => s.movePost);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Only show posts for the active workspace
  const posts = useMemo(
    () => allPosts.filter((p) => (p.workspace_id ?? "personal") === activeWorkspaceId),
    [allPosts, activeWorkspaceId]
  );

  const [dragging, setDragging] = useState<ScheduledPost | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const postsByCol = useMemo(() => {
    const map: Record<ScheduleColumn, ScheduledPost[]> = {
      content: [],
      this_week: [],
      today: [],
      published: [],
    };
    for (const p of [...posts].sort((a, b) => a.position - b.position)) {
      map[p.column].push(p);
    }
    return map;
  }, [posts]);

  const findPost = (id: string) => posts.find((p) => p.id === id);
  const isColumn = (val: string): val is ScheduleColumn =>
    COLUMNS.includes(val as ScheduleColumn);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDragging(findPost(active.id as string) ?? null);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activePost = findPost(activeId);
    if (!activePost) return;

    if (isColumn(overId) && activePost.column !== overId) {
      movePost(activeId, overId, postsByCol[overId].length * 100);
      return;
    }

    const overPost = findPost(overId);
    if (overPost && overPost.column !== activePost.column) {
      movePost(activeId, overPost.column, overPost.position - 1);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const activePost = findPost(activeId);
    const overPost = findPost(overId);
    if (!activePost || !overPost) return;
    if (activePost.column !== overPost.column) return;

    const col = [...postsByCol[activePost.column]];
    const fromIdx = col.findIndex((p) => p.id === activeId);
    const toIdx = col.findIndex((p) => p.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;

    arrayMove(col, fromIdx, toIdx).forEach((p, i) => {
      if (p.position !== i * 100) updatePost(p.id, { position: i * 100 });
    });
  };

  const todayCount = postsByCol.today.length;
  const weekCount = postsByCol.this_week.length;
  const publishedCount = postsByCol.published.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl font-medium">جدولة المنشورات</h1>
        </div>
        <div className="ms-auto flex items-center gap-4 font-micro text-xs text-muted-foreground">
          {todayCount > 0 && (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-primary">
              {todayCount} للنشر اليوم
            </span>
          )}
          {weekCount > 0 && (
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-400">
              {weekCount} هذا الأسبوع
            </span>
          )}
          {publishedCount > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
              {publishedCount} تم النشر
            </span>
          )}
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {COLUMNS.map((col) => (
            <ScheduleCol key={col} column={col} posts={postsByCol[col]} onOpenPost={setOpenPostId} />
          ))}
        </div>

        <DragOverlay>
          {dragging && <ScheduleCardOverlay post={dragging} />}
        </DragOverlay>
      </DndContext>

      <SchedulePostDrawer postId={openPostId} onClose={() => setOpenPostId(null)} />
    </div>
  );
}
