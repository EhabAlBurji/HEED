import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "../lib/safeStorage";
import { useWorkspaceStore } from "./workspaceStore";
import {
  pushBoard,
  deleteBoardServer,
  pushNode,
  pushNodeDebounced,
  deleteNodeServer,
  pushEdge,
  deleteEdgeServer,
} from "../lib/canvasSync";

// =========================================================================
// Heed — Project Canvas store (node-based planning "spaces", per project)
// =========================================================================
// Local-first (zustand persist). A project can have multiple named Spaces;
// each Space holds its own nodes/edges/viewport. Includes a lightweight
// undo/redo history. Structured to mirror tasksStore so a Supabase sync
// layer can be added later with no UI rework.
// =========================================================================

const activeWs = () => useWorkspaceStore.getState().activeWorkspaceId;

export type CanvasNodeType =
  | "task"
  | "image"
  | "video"
  | "voice"
  | "text"
  | "sticky"
  | "shape"
  | "frame"
  | "link";

export type CanvasNodeData = {
  taskId?: string; // task node → references a real Task.id
  src?: string; // image/video/voice as base64 data URL (local)
  url?: string; // video embed / web link / mp4 url
  title?: string;
  text?: string;
  color?: string; // sticky / shape / frame / voice background
  shape?: "rect" | "ellipse";
  // text styling
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  stroke?: boolean;
};

export type CanvasNode = {
  id: string;
  project_id: string;
  space_id: string;
  workspace_id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  data: CanvasNodeData;
  created_at: string;
  updated_at: string;
};

export type CanvasEdge = {
  id: string;
  project_id: string;
  space_id: string;
  workspace_id: string;
  source: string;
  target: string;
  label?: string;
  created_at: string;
  updated_at: string;
};

export type CanvasSpace = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
};

// A board is the single visual planning surface. It can be standalone
// (project_id = null) or belong to a project (project_id set). Its nodes/edges
// use the board id as their space_id.
export type Board = {
  id: string;
  name: string;
  project_id: string | null;
  workspace_id: string;
  shared_workspace_ids: string[];
  cover?: string | null; // base64 data URL or null (auto-picked if null)
  created_at: string;
};

export type Viewport = { x: number; y: number; zoom: number };

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

type Snapshot = { nodes: CanvasNode[]; edges: CanvasEdge[]; boards: Board[] };
const HISTORY_LIMIT = 60;

type CanvasState = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  boards: Board[];
  viewports: Record<string, Viewport>; // boardId → viewport

  // history (not persisted)
  past: Snapshot[];
  future: Snapshot[];

  // boards (standalone or project-scoped)
  addBoard: (name?: string, projectId?: string | null) => Board;
  renameBoard: (id: string, name: string) => void;
  setBoardCover: (id: string, cover: string | null) => void;
  removeBoard: (id: string) => void;
  shareBoardTo: (id: string, wsId: string) => void;
  unshareBoardFrom: (id: string, wsId: string) => void;
  // returns an existing project board or creates one
  ensureProjectBoard: (projectId: string) => Board;

  // nodes / edges
  addNode: (
    input: Partial<CanvasNode> & { project_id: string; space_id: string; type: CanvasNodeType }
  ) => CanvasNode;
  updateNode: (id: string, patch: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  bringToFront: (id: string) => void;
  addEdge: (source: string, target: string, project_id: string, space_id: string) => void;
  removeEdge: (id: string) => void;

  // viewport
  setViewport: (spaceId: string, viewport: Viewport) => void;

  // history
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
};

const defaultSize = (type: CanvasNodeType): { width: number; height: number } => {
  switch (type) {
    case "task":
      return { width: 230, height: 96 };
    case "image":
      return { width: 240, height: 180 };
    case "video":
      return { width: 320, height: 180 };
    case "voice":
      return { width: 250, height: 92 };
    case "text":
      return { width: 220, height: 120 };
    case "sticky":
      return { width: 180, height: 180 };
    case "shape":
      return { width: 200, height: 140 };
    case "frame":
      return { width: 420, height: 320 };
    case "link":
      return { width: 240, height: 92 };
  }
};

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => {
      // Push the current document state onto the undo stack (and clear redo).
      const pushHistory = () =>
        set((s) => ({
          past: [...s.past, { nodes: s.nodes, edges: s.edges, boards: s.boards }].slice(-HISTORY_LIMIT),
          future: [],
        }));

      return {
        nodes: [],
        edges: [],
        boards: [],
        viewports: {},
        past: [],
        future: [],

        addBoard: (name, projectId = null) => {
          const count = get().boards.filter((b) => b.workspace_id === activeWs()).length;
          const board: Board = {
            id: uid(),
            name:
              name?.trim() ||
              `${typeof localStorage !== "undefined" && localStorage.getItem("i18nextLng")?.startsWith("ar") ? "بورد" : "Board"} ${count + 1}`,
            project_id: projectId,
            workspace_id: activeWs(),
            shared_workspace_ids: [],
            created_at: nowIso(),
          };
          set((s) => ({ boards: [...s.boards, board] }));
          void pushBoard(board);
          return board;
        },

        ensureProjectBoard: (projectId) => {
          const existing = get().boards.find((b) => b.project_id === projectId);
          if (existing) return existing;
          return get().addBoard(undefined, projectId);
        },
        renameBoard: (id, name) => {
          set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, name } : b)) }));
          const b = get().boards.find((x) => x.id === id);
          if (b) void pushBoard(b);
        },
        setBoardCover: (id, cover) => {
          set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, cover } : b)) }));
          const b = get().boards.find((x) => x.id === id);
          if (b) void pushBoard(b);
        },
        removeBoard: (id) => {
          set((s) => ({
            boards: s.boards.filter((b) => b.id !== id),
            nodes: s.nodes.filter((n) => n.space_id !== id),
            edges: s.edges.filter((e) => e.space_id !== id),
          }));
          void deleteBoardServer(id);
        },
        shareBoardTo: (id, wsId) => {
          set((s) => ({
            boards: s.boards.map((b) =>
              b.id === id
                ? { ...b, shared_workspace_ids: [...new Set([...b.shared_workspace_ids, wsId])] }
                : b
            ),
          }));
          const b = get().boards.find((x) => x.id === id);
          if (b) void pushBoard(b);
        },
        unshareBoardFrom: (id, wsId) => {
          set((s) => ({
            boards: s.boards.map((b) =>
              b.id === id
                ? { ...b, shared_workspace_ids: b.shared_workspace_ids.filter((w) => w !== wsId) }
                : b
            ),
          }));
          const b = get().boards.find((x) => x.id === id);
          if (b) void pushBoard(b);
        },

        addNode: (input) => {
          pushHistory();
          const size = defaultSize(input.type);
          const maxZ = get().nodes.reduce((m, n) => Math.max(m, n.z), 0);
          const node: CanvasNode = {
            id: input.id ?? uid(),
            project_id: input.project_id,
            space_id: input.space_id,
            workspace_id: input.workspace_id ?? activeWs(),
            type: input.type,
            x: input.x ?? 0,
            y: input.y ?? 0,
            width: input.width ?? size.width,
            height: input.height ?? size.height,
            z: input.z ?? maxZ + 1,
            data: input.data ?? {},
            created_at: nowIso(),
            updated_at: nowIso(),
          };
          set((s) => ({ nodes: [...s.nodes, node] }));
          void pushNode(node);
          return node;
        },

        updateNode: (id, patch) => {
          set((s) => ({
            nodes: s.nodes.map((n) =>
              n.id === id ? { ...n, ...patch, updated_at: nowIso() } : n
            ),
          }));
          pushNodeDebounced(id);
        },

        removeNode: (id) => {
          pushHistory();
          set((s) => ({
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.source !== id && e.target !== id),
          }));
          void deleteNodeServer(id);
        },

        bringToFront: (id) => {
          const maxZ = get().nodes.reduce((m, n) => Math.max(m, n.z), 0);
          set((s) => ({
            nodes: s.nodes.map((n) => (n.id === id ? { ...n, z: maxZ + 1 } : n)),
          }));
          pushNodeDebounced(id);
        },

        addEdge: (source, target, project_id, space_id) => {
          if (source === target) return;
          const exists = get().edges.some(
            (e) =>
              e.space_id === space_id &&
              ((e.source === source && e.target === target) ||
                (e.source === target && e.target === source))
          );
          if (exists) return;
          pushHistory();
          const edge: CanvasEdge = {
            id: uid(),
            project_id,
            space_id,
            workspace_id: activeWs(),
            source,
            target,
            created_at: nowIso(),
            updated_at: nowIso(),
          };
          set((s) => ({ edges: [...s.edges, edge] }));
          void pushEdge(edge);
        },

        removeEdge: (id) => {
          pushHistory();
          set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
          void deleteEdgeServer(id);
        },

        setViewport: (spaceId, viewport) =>
          set((s) => ({ viewports: { ...s.viewports, [spaceId]: viewport } })),

        // History ----------------------------------------------------------
        checkpoint: () => pushHistory(),

        undo: () => {
          const { past } = get();
          if (past.length === 0) return;
          const prev = past[past.length - 1];
          set((s) => ({
            past: s.past.slice(0, -1),
            future: [{ nodes: s.nodes, edges: s.edges, boards: s.boards }, ...s.future].slice(0, HISTORY_LIMIT),
            nodes: prev.nodes,
            edges: prev.edges,
            boards: prev.boards,
          }));
        },

        redo: () => {
          const { future } = get();
          if (future.length === 0) return;
          const next = future[0];
          set((s) => ({
            future: s.future.slice(1),
            past: [...s.past, { nodes: s.nodes, edges: s.edges, boards: s.boards }].slice(-HISTORY_LIMIT),
            nodes: next.nodes,
            edges: next.edges,
            boards: next.boards,
          }));
        },
      };
    },
    {
      name: "heed:canvas",
      version: 3,
      storage: safeJSONStorage(),
      // Persist document data only — never the in-memory undo history.
      partialize: (s) => ({
        nodes: s.nodes,
        edges: s.edges,
        boards: s.boards,
        viewports: s.viewports,
      }),
      migrate: (state: unknown, version: number | undefined) => {
        const s = (state ?? {}) as Record<string, unknown>;
        const v = version ?? 0;
        // v<2: assign space_id to legacy nodes/edges by grouping per project.
        if (v < 2) {
          const nodes = (s.nodes as CanvasNode[] | undefined) ?? [];
          const edges = (s.edges as CanvasEdge[] | undefined) ?? [];
          const byProject = new Map<string, string>();
          const spaces: CanvasSpace[] = [];
          const ensure = (pid: string) => {
            let id = byProject.get(pid);
            if (!id) {
              id = uid();
              byProject.set(pid, id);
              spaces.push({ id, project_id: pid, name: "المخطّط 1", created_at: nowIso() });
            }
            return id;
          };
          s.nodes = nodes.map((n) => ({ ...n, space_id: n.space_id ?? ensure(n.project_id) }));
          s.edges = edges.map((e) => ({ ...e, space_id: e.space_id ?? ensure(e.project_id) }));
          s.spaces = spaces;
        }
        // v<3: Spaces are retired — every Space becomes a Board (keeping its id
        // so nodes/edges keyed by space_id still resolve). Boards gain project_id.
        if (v < 3) {
          const spaces = (s.spaces as CanvasSpace[] | undefined) ?? [];
          const oldBoards = (s.boards as Board[] | undefined) ?? [];
          const spaceBoards: Board[] = spaces.map((sp) => ({
            id: sp.id,
            name: sp.name,
            project_id: sp.project_id,
            workspace_id: "personal",
            shared_workspace_ids: [],
            created_at: sp.created_at,
          }));
          const normalizedOld = oldBoards.map((b) => ({ ...b, project_id: b.project_id ?? null }));
          return {
            ...s,
            boards: [...normalizedOld, ...spaceBoards],
            spaces: undefined,
            activeSpace: undefined,
          };
        }
        return s;
      },
    }
  )
);
