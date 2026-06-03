import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Boxes, Hand, Maximize, Minus, MousePointer2, Plus } from "lucide-react";
import {
  useCanvasStore,
  type CanvasNode,
  type CanvasNodeType,
  type Viewport,
} from "../../stores/canvasStore";
import { clampZoom, screenToWorld, type Point } from "../../lib/canvasMath";
import { fileToStorableDataUrl } from "../../lib/imageCompress";
import { cn } from "../../lib/utils";
import { CanvasEdges } from "./CanvasEdges";
import { CanvasNodeView } from "./CanvasNodeView";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasLightbox, type LightboxContent } from "./CanvasLightbox";

// Node types offered in the right-click menu + draggable from the toolbar.
const NODE_ITEMS: { type: CanvasNodeType; labelKey: string; data?: CanvasNode["data"] }[] = [
  { type: "text", labelKey: "canvas.nText" },
  { type: "sticky", labelKey: "canvas.nSticky" },
  { type: "image", labelKey: "canvas.nImage" },
  { type: "video", labelKey: "canvas.nVideo" },
  { type: "voice", labelKey: "canvas.nVoice" },
  { type: "link", labelKey: "canvas.nLink" },
  { type: "frame", labelKey: "canvas.nFrame" },
  { type: "shape", labelKey: "canvas.nRect", data: { shape: "rect" } },
  { type: "shape", labelKey: "canvas.nCircle", data: { shape: "ellipse" } },
];

// The reusable infinite-canvas surface. Renders/edits the nodes & edges that
// belong to one `spaceId` (a project Space OR a standalone Board). `projectId`
// scopes the task-card picker (null for standalone boards = whole workspace).
export function CanvasSurface({
  spaceId,
  projectId,
  onOpenTask,
  topCenter,
  topRight,
}: {
  spaceId: string;
  projectId: string | null;
  onOpenTask: (taskId: string) => void;
  topCenter?: ReactNode;
  topRight?: ReactNode;
}) {
  const { t } = useTranslation();
  const allNodes = useCanvasStore((s) => s.nodes);
  const allEdges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const updateNode = useCanvasStore((s) => s.updateNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const checkpoint = useCanvasStore((s) => s.checkpoint);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const nodes = useMemo(
    () => allNodes.filter((n) => n.space_id === spaceId),
    [allNodes, spaceId]
  );
  const edges = useMemo(
    () => allEdges.filter((e) => e.space_id === spaceId),
    [allEdges, spaceId]
  );
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const vpRef = useRef(vp);
  vpRef.current = vp;

  useEffect(() => {
    setVp(useCanvasStore.getState().viewports[spaceId] ?? { x: 0, y: 0, zoom: 1 });
  }, [spaceId]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectPt, setConnectPt] = useState<Point | null>(null);
  const [lightbox, setLightbox] = useState<LightboxContent | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [tool, setTool] = useState<"hand" | "select">("hand");
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; world: Point } | null>(null);

  const selectOne = (id: string) => setSelectedIds(new Set([id]));
  const clearSelection = () => setSelectedIds(new Set());

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const marqueeRef = useRef<{ sx: number; sy: number } | null>(null);
  const commitTimer = useRef<number | undefined>(undefined);

  const scheduleCommit = () => {
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => setViewport(spaceId, vpRef.current), 350);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setVp((v) => {
          const zoom = clampZoom(v.zoom * (1 - e.deltaY * 0.0015));
          const wx = (px - v.x) / v.zoom;
          const wy = (py - v.y) / v.zoom;
          return { x: px - wx * zoom, y: py - wy * zoom, zoom };
        });
      } else {
        setVp((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
      scheduleCommit();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const typing = tag === "input" || tag === "textarea";
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        if (typing) return;
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (typing) return;
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
          setSelectedEdgeId(null);
        } else if (selectedIds.size) {
          selectedIds.forEach((id) => removeNode(id));
          clearSelection();
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "g" || e.key === "G")) {
        if (typing) return;
        e.preventDefault();
        groupSelection();
      }
      // Zoom shortcuts: Cmd/Ctrl + (+/=) zoom in, Cmd/Ctrl + (-/_) zoom out,
      // Cmd/Ctrl + 0 reset. Plain +/- also work for convenience.
      if (!typing) {
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.2); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.2); }
        else if (mod && e.key === "0") { e.preventDefault(); resetView(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, selectedEdgeId, removeEdge, removeNode, undo, redo]);

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top }, vpRef.current);
  };

  const onBgPointerDown = (e: ReactPointerEvent) => {
    setCtxMenu(null);
    if (e.button !== 0) return;
    clearSelection();
    setSelectedEdgeId(null);
    if (tool === "select") {
      const p = toWorld(e.clientX, e.clientY);
      marqueeRef.current = { sx: p.x, sy: p.y };
      setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      panRef.current = { sx: e.clientX, sy: e.clientY, ox: vp.x, oy: vp.y };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (connectFrom) {
      setConnectPt(toWorld(e.clientX, e.clientY));
      return;
    }
    if (marqueeRef.current) {
      const p = toWorld(e.clientX, e.clientY);
      const { sx, sy } = marqueeRef.current;
      setMarquee({ x: Math.min(sx, p.x), y: Math.min(sy, p.y), w: Math.abs(p.x - sx), h: Math.abs(p.y - sy) });
      return;
    }
    if (panRef.current) {
      setVp((v) => ({
        ...v,
        x: panRef.current!.ox + (e.clientX - panRef.current!.sx),
        y: panRef.current!.oy + (e.clientY - panRef.current!.sy),
      }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (connectFrom) {
      const w = toWorld(e.clientX, e.clientY);
      const hit = [...nodes]
        .sort((a, b) => b.z - a.z)
        .find(
          (n) =>
            n.id !== connectFrom &&
            w.x >= n.x &&
            w.x <= n.x + n.width &&
            w.y >= n.y &&
            w.y <= n.y + n.height
        );
      if (hit) addEdge(connectFrom, hit.id, projectId ?? "", spaceId);
      setConnectFrom(null);
      setConnectPt(null);
    }
    if (marqueeRef.current && marquee) {
      // select every node intersecting the marquee rectangle
      const hits = nodes.filter(
        (n) =>
          n.x < marquee.x + marquee.w &&
          n.x + n.width > marquee.x &&
          n.y < marquee.y + marquee.h &&
          n.y + n.height > marquee.y
      );
      setSelectedIds(new Set(hits.map((n) => n.id)));
      marqueeRef.current = null;
      setMarquee(null);
    }
    if (panRef.current) {
      panRef.current = null;
      scheduleCommit();
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // Group the current multi-selection: draw a colored frame behind them.
  const groupSelection = () => {
    const sel = nodes.filter((n) => selectedIds.has(n.id));
    if (sel.length < 2) return;
    const pad = 28;
    const minX = Math.min(...sel.map((n) => n.x)) - pad;
    const minY = Math.min(...sel.map((n) => n.y)) - pad - 12;
    const maxX = Math.max(...sel.map((n) => n.x + n.width)) + pad;
    const maxY = Math.max(...sel.map((n) => n.y + n.height)) + pad;
    const minZ = Math.min(...sel.map((n) => n.z));
    const frame = addNode({
      project_id: projectId ?? "",
      space_id: spaceId,
      type: "frame",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      data: { title: t("canvas.groupName"), color: "#6735E1" },
    });
    // push the frame behind the grouped nodes
    updateNode(frame.id, { z: minZ - 1 });
  };

  // Drag & drop media files from the OS.
  const onDragOverFiles = (e: ReactDragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    if (!types.includes("Files") && !types.includes("application/x-heed-node")) return;
    e.preventDefault();
    if (types.includes("Files")) setDropActive(true);
  };
  const onDragLeaveFiles = (e: ReactDragEvent) => {
    if (e.currentTarget === e.target) setDropActive(false);
  };
  const onDropFiles = (e: ReactDragEvent) => {
    // A node type dragged from the toolbar → drop it at the cursor.
    const dragged = e.dataTransfer.getData("application/x-heed-node");
    if (dragged) {
      e.preventDefault();
      setDropActive(false);
      try {
        const { type, data } = JSON.parse(dragged) as { type: CanvasNodeType; data?: CanvasNode["data"] };
        addAt(type, toWorld(e.clientX, e.clientY), data);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDropActive(false);
    const base = toWorld(e.clientX, e.clientY);
    Array.from(e.dataTransfer.files).forEach((file, i) => {
      const type: CanvasNodeType | null = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
        ? "voice"
        : null;
      if (!type) return;
      // Compress images before storing (raw multi-MB base64 lags persist/sync).
      void fileToStorableDataUrl(file).then((src) => {
        const node = addNode({
          project_id: projectId ?? "",
          space_id: spaceId,
          type,
          x: base.x,
          y: base.y,
          data: { src },
        });
        updateNode(node.id, {
          x: base.x - node.width / 2 + i * 24,
          y: base.y - node.height / 2 + i * 24,
        });
      });
    });
  };

  // Add a node centered on a given world point.
  const addAt = (type: CanvasNodeType, world: Point, data?: CanvasNode["data"]) => {
    const node = addNode({ project_id: projectId ?? "", space_id: spaceId, type, x: world.x, y: world.y, data });
    updateNode(node.id, { x: world.x - node.width / 2, y: world.y - node.height / 2 });
    selectOne(node.id);
  };

  const handleAdd = (type: CanvasNodeType, data?: CanvasNode["data"]) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    addAt(type, screenToWorld({ x: rect.width / 2, y: rect.height / 2 }, vpRef.current), data);
  };

  // Right-click on the canvas → text menu of node types, added at the cursor.
  const onContextMenu = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-nodrag],[data-canvas-ui]")) return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, world: toWorld(e.clientX, e.clientY) });
  };

  const zoomBy = (factor: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const px = rect.width / 2;
    const py = rect.height / 2;
    setVp((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const wx = (px - v.x) / v.zoom;
      const wy = (py - v.y) / v.zoom;
      return { x: px - wx * zoom, y: py - wy * zoom, zoom };
    });
    scheduleCommit();
  };
  const resetView = () => {
    setVp({ x: 0, y: 0, zoom: 1 });
    scheduleCommit();
  };

  const pendingSource = connectFrom ? nodeById.get(connectFrom) : undefined;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden bg-[radial-gradient(circle,hsl(var(--muted-foreground)/0.28)_1.4px,transparent_1.4px)] [background-size:22px_22px]",
        tool === "select" ? "cursor-default" : panRef.current ? "cursor-grabbing" : "cursor-grab"
      )}
      onPointerDown={onBgPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onDragOver={onDragOverFiles}
      onDragLeave={onDragLeaveFiles}
      onDrop={onDropFiles}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}
      >
        <CanvasEdges
          edges={edges}
          nodeById={nodeById}
          pending={pendingSource && connectPt ? { source: pendingSource, to: connectPt } : null}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={(id) => {
            setSelectedEdgeId(id);
            clearSelection();
          }}
          onRemoveEdge={(id) => {
            removeEdge(id);
            setSelectedEdgeId(null);
          }}
        />
        {marquee && (
          <div
            className="pointer-events-none absolute border-2 border-primary/60 bg-primary/10"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
        {nodes.map((n) => (
          <CanvasNodeView
            key={n.id}
            node={n}
            zoom={vp.zoom}
            selected={selectedIds.has(n.id)}
            connecting={Boolean(connectFrom) && connectFrom !== n.id}
            onSelect={(id) => {
              selectOne(id);
              setSelectedEdgeId(null);
            }}
            onStartConnect={(id, e) => {
              setConnectFrom(id);
              setConnectPt(toWorld(e.clientX, e.clientY));
              try {
                containerRef.current?.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            onOpenTask={onOpenTask}
            onCheckpoint={checkpoint}
            onExpand={setLightbox}
          />
        ))}
      </div>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="font-micro text-sm text-muted-foreground/50">
            {t("canvas.empty")}
          </p>
        </div>
      )}

      {topCenter}
      <CanvasToolbar projectId={projectId} onAdd={handleAdd} />
      {topRight && <div className="absolute end-4 top-4 z-20">{topRight}</div>}

      {/* Tool toggle: Hand (pan) / Select (marquee) + Group */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 start-4 z-20 flex items-center gap-1 rounded-xl border border-border/60 bg-card/90 p-1 shadow-xl backdrop-blur"
      >
        <button
          onClick={() => setTool("hand")}
          title={t("canvas.pan")}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md transition",
            tool === "hand" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          onClick={() => setTool("select")}
          title={t("canvas.select")}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md transition",
            tool === "select" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>
        {selectedIds.size >= 2 && (
          <>
            <div className="mx-0.5 h-5 w-px bg-border/60" />
            <button
              onClick={groupSelection}
              title={t("canvas.group")}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary/10 px-2 text-primary transition hover:bg-primary/20"
            >
              <Boxes className="h-4 w-4" />
              <span className="font-micro text-[11px]">{selectedIds.size}</span>
            </button>
          </>
        )}
      </div>

      {/* Zoom controls */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 end-4 z-20 flex items-center gap-1 rounded-xl border border-border/60 bg-card/90 p-1 shadow-xl backdrop-blur"
      >
        <ZoomBtn onClick={() => zoomBy(1 / 1.2)} title={t("canvas.zoomOut")}>
          <Minus className="h-4 w-4" />
        </ZoomBtn>
        <button
          onClick={resetView}
          className="min-w-[3rem] rounded-md px-2 py-1 font-micro text-[11px] tabular-nums text-muted-foreground hover:bg-secondary hover:text-foreground"
          title={t("canvas.reset")}
        >
          {Math.round(vp.zoom * 100)}%
        </button>
        <ZoomBtn onClick={() => zoomBy(1.2)} title={t("canvas.zoomIn")}>
          <Plus className="h-4 w-4" />
        </ZoomBtn>
        <ZoomBtn onClick={resetView} title={t("canvas.center")}>
          <Maximize className="h-4 w-4" />
        </ZoomBtn>
      </div>

      {dropActive && (
        <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-primary/70 bg-primary/5">
          <p className="rounded-lg bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {t("canvas.dropMedia")}
          </p>
        </div>
      )}

      {/* Right-click menu: text list of node types, added at the cursor. */}
      {ctxMenu && (
        <div
          data-canvas-ui
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute z-40 w-44 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-1 shadow-2xl backdrop-blur"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <p className="px-2 py-1 font-micro text-[10px] uppercase tracking-wider text-muted-foreground/60">
            {t("canvas.addElement")}
          </p>
          {NODE_ITEMS.map((it, i) => (
            <button
              key={i}
              onClick={() => { addAt(it.type, ctxMenu.world, it.data); setCtxMenu(null); }}
              className="block w-full rounded-md px-2.5 py-1.5 text-start text-sm text-foreground transition hover:bg-secondary"
            >
              {t(it.labelKey)}
            </button>
          ))}
        </div>
      )}

      <CanvasLightbox content={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function ZoomBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}
