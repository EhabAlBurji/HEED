import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Baseline,
  Bold,
  GripHorizontal,
  ImagePlus,
  Link2,
  Maximize2,
  Mic,
  Minus,
  Plus,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasNodeType,
} from "../../stores/canvasStore";
import { useTasksStore } from "../../stores/tasksStore";
import { cn } from "../../lib/utils";
import { PRIORITY_STRIPE as priorityStripe } from "../../lib/taskMeta";
import { fileToStorableDataUrl } from "../../lib/imageCompress";
import type { LightboxContent } from "./CanvasLightbox";

const MIN_W = 120;
const MIN_H = 60;

export const NODE_COLORS = [
  "#6735E1",
  "#0A4EFF",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#64748B",
];

function iframeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* not a valid URL */
  }
  return null;
}

export function CanvasNodeView({
  node,
  zoom,
  selected,
  connecting,
  onSelect,
  onStartConnect,
  onOpenTask,
  onCheckpoint,
  onExpand,
}: {
  node: CanvasNode;
  zoom: number;
  selected: boolean;
  connecting: boolean;
  onSelect: (id: string) => void;
  onStartConnect: (id: string, e: ReactPointerEvent) => void;
  onOpenTask: (taskId: string) => void;
  onCheckpoint: () => void;
  onExpand: (content: LightboxContent) => void;
}) {
  const { t } = useTranslation();
  const updateNode = useCanvasStore((s) => s.updateNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const bringToFront = useCanvasStore((s) => s.bringToFront);

  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number } | null>(null);
  // Transient drag/resize: the offset is applied visually during the gesture and
  // committed to the store ONCE on pointer-up. This avoids re-serializing the
  // whole canvas (with base64 media) to localStorage on every mouse-move frame —
  // the cause of the full-app lag when a board has images/videos.
  const [dragOff, setDragOff] = useState<{ dx: number; dy: number } | null>(null);
  const [sizeOff, setSizeOff] = useState<{ dw: number; dh: number } | null>(null);
  const dragOffRef = useRef({ dx: 0, dy: 0 });
  const sizeOffRef = useRef({ dw: 0, dh: 0 });

  const patchData = (patch: Partial<CanvasNode["data"]>) =>
    updateNode(node.id, { data: { ...node.data, ...patch } });

  const startDrag = (e: ReactPointerEvent) => {
    e.stopPropagation();
    onSelect(node.id);
    bringToFront(node.id);
    onCheckpoint();
    dragRef.current = { sx: e.clientX, sy: e.clientY };
    dragOffRef.current = { dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Drag from the node body (non-interactive areas).
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-nodrag]")) {
      // interactive area — keep the event from reaching the canvas (which would
      // capture the pointer and swallow the click), but don't start a drag.
      e.stopPropagation();
      onSelect(node.id);
      return;
    }
    startDrag(e);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.sx) / zoom;
    const dy = (e.clientY - dragRef.current.sy) / zoom;
    dragOffRef.current = { dx, dy };
    setDragOff({ dx, dy }); // re-renders only this node — no store write/serialize
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragRef.current) {
      const { dx, dy } = dragOffRef.current;
      dragRef.current = null;
      if (dx || dy) updateNode(node.id, { x: node.x + dx, y: node.y + dy }); // single commit
      setDragOff(null);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // Resize (bottom-end corner) — transient, committed on pointer-up.
  const onResizeDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    onCheckpoint();
    resizeRef.current = { sx: e.clientX, sy: e.clientY };
    sizeOffRef.current = { dw: 0, dh: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: ReactPointerEvent) => {
    if (!resizeRef.current) return;
    const dw = (e.clientX - resizeRef.current.sx) / zoom;
    const dh = (e.clientY - resizeRef.current.sy) / zoom;
    sizeOffRef.current = { dw, dh };
    setSizeOff({ dw, dh });
  };
  const onResizeUp = (e: ReactPointerEvent) => {
    if (resizeRef.current) {
      const { dw, dh } = sizeOffRef.current;
      resizeRef.current = null;
      if (dw || dh)
        updateNode(node.id, {
          width: Math.max(MIN_W, node.width + dw),
          height: Math.max(MIN_H, node.height + dh),
        });
      setSizeOff(null);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const resizable: CanvasNodeType[] = ["image", "video", "frame", "shape", "text", "sticky"];
  const showResize = selected && resizable.includes(node.type);
  const hasColor =
    node.type === "sticky" ||
    node.type === "shape" ||
    node.type === "frame" ||
    node.type === "voice";
  const isText = node.type === "text";
  const fontSize = node.data.fontSize ?? 18;

  return (
    <div
      className="group/cnode absolute select-none"
      style={{
        left: node.x,
        top: node.y,
        width: sizeOff ? Math.max(MIN_W, node.width + sizeOff.dw) : node.width,
        height: sizeOff ? Math.max(MIN_H, node.height + sizeOff.dh) : node.height,
        zIndex: node.z,
        transform: dragOff ? `translate(${dragOff.dx}px, ${dragOff.dy}px)` : undefined,
        willChange: dragOff || sizeOff ? "transform, width, height" : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className={cn(
          "relative h-full w-full rounded-xl",
          connecting && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background",
          selected && node.type !== "shape" && "outline outline-2 outline-primary/60"
        )}
      >
        <NodeBody
          node={node}
          selected={selected}
          patchData={patchData}
          onOpenTask={onOpenTask}
          onCheckpoint={onCheckpoint}
          onExpand={onExpand}
        />

        {/* Chrome bar: drag handle + colors + delete (hover or selected) */}
        <div
          className={cn(
            "absolute -top-8 start-0 flex items-center gap-1 rounded-lg border border-border/60 bg-card px-1 py-1 shadow-lg transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover/cnode:opacity-100"
          )}
        >
          {/* Move handle (NOT data-nodrag → starts a node drag) */}
          <button
            onPointerDown={startDrag}
            className="grid h-6 w-6 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
            title={t("canvas.move")}
          >
            <GripHorizontal className="h-3.5 w-3.5" />
          </button>

          {hasColor &&
            NODE_COLORS.map((c) => (
              <button
                key={c}
                data-nodrag
                onClick={() => patchData({ color: c })}
                className="h-4 w-4 rounded-full border border-black/10 transition hover:scale-110"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}

          {isText && (
            <>
              {NODE_COLORS.map((c) => (
                <button
                  key={c}
                  data-nodrag
                  onClick={() => patchData({ textColor: c })}
                  className={cn(
                    "h-4 w-4 rounded-full border transition hover:scale-110",
                    node.data.textColor === c ? "border-foreground ring-1 ring-foreground" : "border-black/10"
                  )}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <div className="mx-0.5 h-5 w-px bg-border/60" />
              <ChromeBtn active={node.data.bold} onClick={() => patchData({ bold: !node.data.bold })} title={t("canvas.bold")}>
                <Bold className="h-3.5 w-3.5" />
              </ChromeBtn>
              <ChromeBtn active={node.data.stroke} onClick={() => patchData({ stroke: !node.data.stroke })} title={t("canvas.stroke")}>
                <Baseline className="h-3.5 w-3.5" />
              </ChromeBtn>
              <ChromeBtn onClick={() => patchData({ fontSize: Math.max(10, fontSize - 2) })} title={t("canvas.smaller")}>
                <Minus className="h-3.5 w-3.5" />
              </ChromeBtn>
              <ChromeBtn onClick={() => patchData({ fontSize: Math.min(72, fontSize + 2) })} title={t("canvas.larger")}>
                <Plus className="h-3.5 w-3.5" />
              </ChromeBtn>
            </>
          )}

          <button
            data-nodrag
            onClick={() => removeNode(node.id)}
            className="grid h-6 w-6 place-items-center rounded-md text-destructive hover:bg-destructive/10"
            title={t("canvas.delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Connection handles (start an edge) */}
        {[
          { pos: "start" as const, style: { insetInlineStart: -7, top: "50%" } },
          { pos: "end" as const, style: { insetInlineEnd: -7, top: "50%" } },
        ].map((h) => (
          <button
            key={h.pos}
            data-nodrag
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, e);
            }}
            className="absolute z-10 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-primary bg-background opacity-0 shadow transition group-hover/cnode:opacity-100 hover:scale-125"
            style={h.style}
            title={t("canvas.connect")}
          />
        ))}

        {/* Resize handle */}
        {showResize && (
          <div
            data-nodrag
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            className="absolute -bottom-1 -end-1 z-10 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-primary bg-background"
          />
        )}
      </div>
    </div>
  );
}

// ── Body by node type ──────────────────────────────────────────────────
function NodeBody({
  node,
  selected,
  patchData,
  onOpenTask,
  onCheckpoint,
  onExpand,
}: {
  node: CanvasNode;
  selected: boolean;
  patchData: (patch: Partial<CanvasNode["data"]>) => void;
  onOpenTask: (taskId: string) => void;
  onCheckpoint: () => void;
  onExpand: (content: LightboxContent) => void;
}) {
  const { t } = useTranslation();
  // Media (iframes/video/audio) swallow pointer events. Make them click-through
  // (so you can drag the node from anywhere) UNTIL the node is selected; then
  // they become interactive so you can play/scrub. Click once to select.
  const mediaPE = { pointerEvents: selected ? ("auto" as const) : ("none" as const) };
  const tasks = useTasksStore((s) => s.tasks);
  const updateNode = useCanvasStore((s) => s.updateNode);

  // Resize the node to match the media's aspect ratio — but only while it's
  // still at its default size (so a user's manual resize is never overridden).
  const fitToMedia = (w: number, h: number, defaultW: number, defaultH: number) => {
    if (!w || !h) return;
    if (node.width !== defaultW || node.height !== defaultH) return;
    const max = 360;
    const width = Math.min(max, w);
    updateNode(node.id, { width, height: Math.round((width * h) / w) });
  };

  switch (node.type) {
    case "task": {
      const task = tasks.find((t) => t.id === node.data.taskId);
      if (!task) {
        return (
          <Card className="items-center justify-center text-center">
            <p className="font-micro text-[11px] text-muted-foreground/60">{t("canvas.taskDeleted")}</p>
          </Card>
        );
      }
      return (
        <button
          data-nodrag
          onClick={() => onOpenTask(task.id)}
          className="row-surface relative flex h-full w-full items-center gap-2 overflow-hidden rounded-xl px-3 text-start"
        >
          <span className={cn("absolute inset-y-0 start-0 w-[3px]", priorityStripe[task.priority])} />
          <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityStripe[task.priority])} />
          <span
            className={cn(
              "min-w-0 flex-1 text-[13px] font-medium leading-tight line-clamp-2",
              task.status === "done" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
        </button>
      );
    }

    case "image":
      if (!node.data.src) {
        return (
          <UploadCard
            icon={<ImagePlus className="h-5 w-5" />}
            label={t("canvas.uploadImage")}
            accept="image/*"
            compress
            onFile={(dataUrl) => {
              onCheckpoint();
              patchData({ src: dataUrl });
            }}
          />
        );
      }
      return (
        <div className="relative h-full w-full">
          <img
            src={node.data.src}
            alt=""
            draggable={false}
            onLoad={(e) => fitToMedia(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight, 240, 180)}
            onDoubleClick={() => onExpand({ kind: "image", src: node.data.src! })}
            className="h-full w-full rounded-xl border border-border/60 bg-black/20 object-contain"
          />
          <ExpandBtn onClick={() => onExpand({ kind: "image", src: node.data.src! })} />
        </div>
      );

    case "video": {
      const embed = node.data.url ? iframeEmbed(node.data.url) : null;
      if (embed) {
        return (
          <div className={cn("relative h-full w-full", !selected && "cursor-grab")}>
            <iframe
              data-nodrag
              src={embed}
              title="video"
              style={mediaPE}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="h-full w-full rounded-xl border border-border/60 bg-black"
            />
            <ExpandBtn onClick={() => onExpand({ kind: "video-embed", src: embed })} />
          </div>
        );
      }
      const directSrc = node.data.src || (node.data.url && !embed ? node.data.url : "");
      if (directSrc) {
        return (
          <div className={cn("relative h-full w-full", !selected && "cursor-grab")}>
            <video
              data-nodrag
              src={directSrc}
              controls
              style={mediaPE}
              onLoadedMetadata={(e) => fitToMedia(e.currentTarget.videoWidth, e.currentTarget.videoHeight, 320, 180)}
              onDoubleClick={() => onExpand({ kind: "video", src: directSrc })}
              className="h-full w-full rounded-xl border border-border/60 bg-black"
            />
            <ExpandBtn onClick={() => onExpand({ kind: "video", src: directSrc })} />
          </div>
        );
      }
      return (
        <Card className="gap-2">
          <input
            data-nodrag
            type="url"
            placeholder={t("canvas.videoUrl")}
            onFocus={onCheckpoint}
            onKeyDown={(e) => {
              if (e.key === "Enter") patchData({ url: (e.target as HTMLInputElement).value.trim() });
            }}
            onBlur={(e) => patchData({ url: e.target.value.trim() })}
            className="w-full rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 font-micro text-xs outline-none focus:border-primary/50"
          />
          <FilePickButton
            label={t("canvas.orUploadVideo")}
            accept="video/*"
            onFile={(dataUrl) => {
              onCheckpoint();
              patchData({ src: dataUrl });
            }}
          />
        </Card>
      );
    }

    case "voice":
      return (
        <VoiceBody
          src={node.data.src}
          color={node.data.color}
          selected={selected}
          onSet={(src) => {
            onCheckpoint();
            patchData({ src });
          }}
        />
      );

    case "text":
      return (
        <textarea
          data-nodrag
          value={node.data.text ?? ""}
          onFocus={onCheckpoint}
          onChange={(e) => patchData({ text: e.target.value })}
          placeholder={t("canvas.writeText")}
          className="h-full w-full resize-none border-0 bg-transparent p-2 leading-snug outline-none placeholder:text-muted-foreground/40"
          style={{
            color: node.data.textColor ?? "hsl(var(--foreground))",
            fontSize: `${node.data.fontSize ?? 18}px`,
            fontWeight: node.data.bold ? 700 : 500,
            WebkitTextStroke: node.data.stroke
              ? `1px ${node.data.textColor && isLight(node.data.textColor) ? "#000" : "#fff"}`
              : undefined,
          }}
        />
      );

    case "sticky":
      return (
        <textarea
          data-nodrag
          value={node.data.text ?? ""}
          onFocus={onCheckpoint}
          onChange={(e) => patchData({ text: e.target.value })}
          placeholder={t("canvas.note")}
          className="h-full w-full resize-none rounded-xl border-0 p-3 text-sm font-medium text-black/80 shadow-md outline-none"
          style={{ backgroundColor: node.data.color ?? "#F59E0B" }}
        />
      );

    case "shape":
      return (
        <div
          className="h-full w-full border-2"
          style={{
            borderColor: node.data.color ?? NODE_COLORS[0],
            backgroundColor: `${node.data.color ?? NODE_COLORS[0]}1A`,
            borderRadius: node.data.shape === "ellipse" ? "9999px" : "0.75rem",
          }}
        />
      );

    case "frame":
      return (
        <div
          className="h-full w-full rounded-xl border-2 border-dashed"
          style={{ borderColor: node.data.color ?? NODE_COLORS[6] }}
        >
          <input
            data-nodrag
            value={node.data.title ?? ""}
            onFocus={onCheckpoint}
            onChange={(e) => patchData({ title: e.target.value })}
            placeholder={t("canvas.stageTitle")}
            className="w-full bg-transparent px-3 py-1.5 text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
            style={{ color: node.data.color ?? NODE_COLORS[6] }}
          />
        </div>
      );

    case "link":
      return (
        <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-border/60 bg-card/70 p-2.5">
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
            <input
              data-nodrag
              value={node.data.title ?? ""}
              onFocus={onCheckpoint}
              onChange={(e) => patchData({ title: e.target.value })}
              placeholder={t("canvas.linkTitle")}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <input
            data-nodrag
            type="url"
            value={node.data.url ?? ""}
            onFocus={onCheckpoint}
            onChange={(e) => patchData({ url: e.target.value })}
            placeholder="https://…"
            className="min-w-0 flex-1 bg-transparent font-micro text-[11px] text-muted-foreground outline-none"
          />
          {node.data.url && (
            <button
              data-nodrag
              onClick={async () => {
                try {
                  const { openUrl } = await import("@tauri-apps/plugin-opener");
                  await openUrl(node.data.url!);
                } catch {
                  window.open(node.data.url!, "_blank");
                }
              }}
              className="mt-auto self-start rounded-md bg-primary/10 px-2 py-0.5 font-micro text-[10px] text-primary hover:bg-primary/20"
            >{t("canvas.open")}</button>
          )}
        </div>
      );
  }
}

// ── Voice note ─────────────────────────────────────────────────────────
function VoiceBody({
  src,
  color,
  selected,
  onSet,
}: {
  src?: string;
  color?: string;
  selected: boolean;
  onSet: (src: string) => void;
}) {
  const { t } = useTranslation();
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tint = color
    ? { backgroundColor: `${color}1F`, borderColor: `${color}66` }
    : undefined;

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => onSet(reader.result as string);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch {
      setError(t("canvas.micError"));
    }
  };
  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  if (src) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col justify-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3",
          !selected && "cursor-grab"
        )}
        style={tint}
      >
        <audio
          data-nodrag
          src={src}
          controls
          className="w-full"
          style={{ pointerEvents: selected ? "auto" : "none" }}
        />
        <button
          data-nodrag
          onClick={() => onSet("")}
          className="self-start font-micro text-[10px] text-muted-foreground hover:text-destructive"
        >{t("canvas.recordAgain")}</button>
      </div>
    );
  }

  return (
    <Card className="gap-2" style={tint}>
      {recording ? (
        <button
          data-nodrag
          onClick={stop}
          className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          <Square className="h-3 w-3 fill-current" />{t("canvas.stopRec")}<span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        </button>
      ) : (
        <button
          data-nodrag
          onClick={start}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Mic className="h-3.5 w-3.5" />{t("canvas.recordVoice")}</button>
      )}
      <button
        data-nodrag
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1 font-micro text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Upload className="h-3 w-3" />{t("canvas.orUploadAudio")}</button>
      <input
        ref={fileRef}
        data-nodrag
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f, onSet);
        }}
      />
      {error && <p className="font-micro text-[10px] text-destructive">{error}</p>}
    </Card>
  );
}

// Hover "expand to fullscreen" button for media nodes.
function ExpandBtn({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      data-nodrag
      onClick={onClick}
      title={t("canvas.expand")}
      className="absolute end-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-lg bg-black/45 text-white opacity-0 backdrop-blur transition hover:bg-black/65 group-hover/cnode:opacity-100"
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Small building blocks ──────────────────────────────────────────────
function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 p-3",
        className
      )}
    >
      {children}
    </div>
  );
}

// Compact chrome-bar toggle button (text styling).
function ChromeBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      data-nodrag
      onClick={onClick}
      title={title}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-md transition",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// Rough luminance check to pick a contrasting stroke color.
function isLight(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function readFile(file: File, cb: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result as string);
  reader.readAsDataURL(file);
}

function UploadCard({
  icon,
  label,
  accept,
  onFile,
  compress,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  onFile: (dataUrl: string) => void;
  compress?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <button
        data-nodrag
        onClick={() => ref.current?.click()}
        className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        {icon}
        <span className="font-micro text-[11px]">{label}</span>
      </button>
      <input
        ref={ref}
        data-nodrag
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (compress) onFile(await fileToStorableDataUrl(f));
          else readFile(f, onFile);
        }}
      />
    </Card>
  );
}

function FilePickButton({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (dataUrl: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        data-nodrag
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1 font-micro text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Upload className="h-3 w-3" />
        {label}
      </button>
      <input
        ref={ref}
        data-nodrag
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readFile(f, onFile);
        }}
      />
    </>
  );
}
