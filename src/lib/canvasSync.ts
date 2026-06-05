// =========================================================================
// Heed — Canvas / Boards sync (shared visual boards across members)
// =========================================================================
// Media (base64 images/video/voice) is uploaded to the `canvas-media` Storage
// bucket and stored as a URL in the node `data` — never base64 in Postgres.
// Realtime changes are applied via setState() (NOT the store mutations) so they
// never echo back as new pushes. Every call no-ops offline/guest.
// Requires migration `20260602000002_canvas_sync.sql`.
// =========================================================================
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { useAuthStore } from "../stores/authStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import {
  useCanvasStore,
  type Board,
  type CanvasEdge,
  type CanvasNode,
} from "../stores/canvasStore";

const canSync = () => {
  if (!isSupabaseConfigured()) return false;
  const u = useAuthStore.getState().user;
  return Boolean(u && u.id !== "guest");
};
const activeWs = () => useWorkspaceStore.getState().activeWorkspaceId;

// ─── Storage: upload a base64 data URL → public URL ──────────────────
async function uploadIfDataUrl(dataUrl: string | undefined, nodeId: string): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;
  try {
    const sb = getSupabase();
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
    const ext = (mime.split("/")[1] ?? "bin").split("+")[0];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${activeWs()}/${nodeId}.${ext}`;
    const { error } = await sb.storage
      .from("canvas-media")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) return dataUrl;
    return sb.storage.from("canvas-media").getPublicUrl(path).data.publicUrl;
  } catch {
    return dataUrl;
  }
}

// ─── Mappers ─────────────────────────────────────────────────────────
const boardFromRow = (r: Record<string, unknown>): Board => ({
  id: r.id as string,
  name: r.name as string,
  project_id: (r.project_id as string) ?? null,
  workspace_id: r.workspace_id as string,
  shared_workspace_ids: (r.shared_workspace_ids as string[]) ?? [],
  cover: (r.cover as string) ?? null,
  created_at: r.created_at as string,
});
const nodeFromRow = (r: Record<string, unknown>): CanvasNode => ({
  id: r.id as string,
  space_id: r.space_id as string,
  project_id: (r.project_id as string) ?? "",
  workspace_id: r.workspace_id as string,
  type: r.type as CanvasNode["type"],
  x: Number(r.x),
  y: Number(r.y),
  width: Number(r.width),
  height: Number(r.height),
  z: Number(r.z),
  data: (r.data as CanvasNode["data"]) ?? {},
  created_at: r.created_at as string,
  updated_at: r.updated_at as string,
});
const edgeFromRow = (r: Record<string, unknown>): CanvasEdge => ({
  id: r.id as string,
  space_id: r.space_id as string,
  project_id: (r.project_id as string) ?? "",
  workspace_id: r.workspace_id as string,
  source: r.source as string,
  target: r.target as string,
  label: (r.label as string) ?? undefined,
  created_at: r.created_at as string,
  updated_at: (r.updated_at as string) ?? (r.created_at as string),
});

function mergeById<T extends { id: string }>(local: T[], incoming: T[]): T[] {
  const ids = new Set(incoming.map((i) => i.id));
  return [...incoming, ...local.filter((l) => !ids.has(l.id))];
}

// ─── Push / delete ───────────────────────────────────────────────────
export async function pushBoard(b: Board) {
  if (!canSync()) return;
  try {
    await getSupabase().from("boards").upsert({
      id: b.id,
      workspace_id: b.workspace_id,
      project_id: b.project_id,
      name: b.name,
      cover: b.cover ?? null,
      shared_workspace_ids: b.shared_workspace_ids,
    });
  } catch {
    /* ignore */
  }
}
export async function deleteBoardServer(id: string) {
  if (!canSync()) return;
  try {
    await getSupabase().from("boards").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}

export async function pushNode(n: CanvasNode) {
  if (!canSync()) return;
  try {
    let data = n.data;
    if (data.src && data.src.startsWith("data:")) {
      const url = await uploadIfDataUrl(data.src, n.id);
      if (url && url !== data.src) {
        data = { ...data, src: url };
        // swap base64 → URL locally so we don't re-upload and peers load by URL
        useCanvasStore.getState().updateNode(n.id, { data });
      }
    }
    await getSupabase().from("canvas_nodes").upsert({
      id: n.id,
      space_id: n.space_id,
      project_id: n.project_id || null,
      workspace_id: n.workspace_id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      z: n.z,
      data: data as never,
    });
  } catch {
    /* ignore */
  }
}
export async function deleteNodeServer(id: string) {
  if (!canSync()) return;
  try {
    await getSupabase().from("canvas_nodes").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}

export async function pushEdge(e: CanvasEdge) {
  if (!canSync()) return;
  try {
    await getSupabase().from("canvas_edges").upsert({
      id: e.id,
      space_id: e.space_id,
      project_id: e.project_id || null,
      workspace_id: e.workspace_id,
      source: e.source,
      target: e.target,
      label: e.label ?? null,
    });
  } catch {
    /* ignore */
  }
}
export async function deleteEdgeServer(id: string) {
  if (!canSync()) return;
  try {
    await getSupabase().from("canvas_edges").delete().eq("id", id);
  } catch {
    /* ignore */
  }
}

// Debounce node pushes so dragging doesn't spam the network.
const nodeTimers = new Map<string, number>();
export function pushNodeDebounced(id: string) {
  if (!canSync()) return;
  const prev = nodeTimers.get(id);
  if (prev) window.clearTimeout(prev);
  nodeTimers.set(
    id,
    window.setTimeout(() => {
      nodeTimers.delete(id);
      const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
      if (node) void pushNode(node);
    }, 450)
  );
}

// ─── Realtime apply (setState only → never re-pushes) ────────────────
function applyNode(p: { eventType: string; new: unknown; old: unknown }) {
  const s = useCanvasStore.getState();
  if (p.eventType === "DELETE") {
    const id = (p.old as { id: string }).id;
    useCanvasStore.setState({ nodes: s.nodes.filter((n) => n.id !== id), edges: s.edges.filter((e) => e.source !== id && e.target !== id) });
  } else {
    const row = nodeFromRow(p.new as Record<string, unknown>);
    // Skip if the user is currently dragging this node (pending local push in debounce queue).
    if (nodeTimers.has(row.id)) return;
    const local = s.nodes.find((n) => n.id === row.id);
    // Last-write-wins: only apply if the incoming row is newer than the local one.
    if (local && local.updated_at > row.updated_at) return;
    useCanvasStore.setState({ nodes: [row, ...s.nodes.filter((n) => n.id !== row.id)] });
  }
}
function applyEdge(p: { eventType: string; new: unknown; old: unknown }) {
  const s = useCanvasStore.getState();
  if (p.eventType === "DELETE") {
    const id = (p.old as { id: string }).id;
    useCanvasStore.setState({ edges: s.edges.filter((e) => e.id !== id) });
  } else {
    const row = edgeFromRow(p.new as Record<string, unknown>);
    useCanvasStore.setState({ edges: [row, ...s.edges.filter((e) => e.id !== row.id)] });
  }
}
function applyBoard(p: { eventType: string; new: unknown; old: unknown }) {
  const s = useCanvasStore.getState();
  if (p.eventType === "DELETE") {
    const id = (p.old as { id: string }).id;
    useCanvasStore.setState({ boards: s.boards.filter((b) => b.id !== id) });
  } else {
    const row = boardFromRow(p.new as Record<string, unknown>);
    useCanvasStore.setState({ boards: [...s.boards.filter((b) => b.id !== row.id), row] });
  }
}

// ─── Pull + subscribe (call on login / workspace change) ─────────────
let chan: RealtimeChannel | null = null;
let canvasReconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function startCanvasSync() {
  if (!canSync()) return;
  const sb = getSupabase();
  const ws = activeWs();
  try {
    const [b, n, e] = await Promise.all([
      sb.from("boards").select("*").eq("workspace_id", ws),
      sb.from("canvas_nodes").select("*").eq("workspace_id", ws),
      sb.from("canvas_edges").select("*").eq("workspace_id", ws),
    ]);
    const serverBoardIds = new Set((b.data ?? []).map((r) => (r as { id: string }).id));
    const serverNodeIds = new Set((n.data ?? []).map((r) => (r as { id: string }).id));
    const serverEdgeIds = new Set((e.data ?? []).map((r) => (r as { id: string }).id));

    useCanvasStore.setState((s) => ({
      boards: b.data ? mergeById(s.boards, (b.data as Record<string, unknown>[]).map(boardFromRow)) : s.boards,
      nodes: n.data ? mergeById(s.nodes, (n.data as Record<string, unknown>[]).map(nodeFromRow)) : s.nodes,
      edges: e.data ? mergeById(s.edges, (e.data as Record<string, unknown>[]).map(edgeFromRow)) : s.edges,
    }));

    // Backfill: upload any local-only content that isn't on the server yet
    // (e.g. boards/nodes made before the cloud tables existed). Uploads media.
    const st = useCanvasStore.getState();
    for (const board of st.boards) {
      if (board.workspace_id === ws && !serverBoardIds.has(board.id)) void pushBoard(board);
    }
    for (const node of st.nodes) {
      if (node.workspace_id === ws && !serverNodeIds.has(node.id)) void pushNode(node);
    }
    for (const edge of st.edges) {
      if (edge.workspace_id === ws && !serverEdgeIds.has(edge.id)) void pushEdge(edge);
    }
  } catch {
    /* ignore */
  }

  // Guard: if the workspace changed while the async pull was in flight, bail out
  // to avoid creating a channel for a stale workspace that would overwrite the
  // channel already created by the new workspace's startCanvasSync() call.
  if (activeWs() !== ws) return;

  stopCanvasSync();
  chan = sb
    .channel("canvas:" + ws)
    .on("postgres_changes", { event: "*", schema: "public", table: "canvas_nodes", filter: `workspace_id=eq.${ws}` }, applyNode)
    .on("postgres_changes", { event: "*", schema: "public", table: "canvas_edges", filter: `workspace_id=eq.${ws}` }, applyEdge)
    .on("postgres_changes", { event: "*", schema: "public", table: "boards", filter: `workspace_id=eq.${ws}` }, applyBoard)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (canvasReconnectTimer) clearTimeout(canvasReconnectTimer);
        canvasReconnectTimer = setTimeout(() => {
          canvasReconnectTimer = null;
          void startCanvasSync();
        }, 5_000);
      }
    });
}

export function stopCanvasSync() {
  if (canvasReconnectTimer) {
    clearTimeout(canvasReconnectTimer);
    canvasReconnectTimer = null;
  }
  if (chan) {
    try {
      getSupabase().removeChannel(chan);
    } catch {
      /* ignore */
    }
    chan = null;
  }
}
