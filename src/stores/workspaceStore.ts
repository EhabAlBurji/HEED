import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  pushWorkspace, deleteWorkspace as syncDeleteWorkspace,
  pushMember, deleteMember as syncDeleteMember,
} from "../lib/sync";

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "member";
  addedAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  type: "personal" | "team";
  color: string;
  memberCount: number;
  members: WorkspaceMember[];
};

type WorkspaceState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspace: (id: string) => void;
  addWorkspace: (input: Omit<Workspace, "id" | "members">) => Workspace;
  deleteWorkspace: (id: string) => void;
  // Leave a shared workspace (just drop it locally + switch away). The caller
  // removes the member row server-side via leaveWorkspaceServer().
  leaveWorkspace: (id: string) => void;
  addMember: (workspaceId: string, member: Omit<WorkspaceMember, "id" | "addedAt">) => void;
  removeMember: (workspaceId: string, memberId: string) => void;
  // Admin actions
  updateWorkspace: (id: string, patch: Partial<Pick<Workspace, "name" | "color">>) => void;
  updateMemberRole: (workspaceId: string, memberId: string, role: WorkspaceMember["role"]) => void;
};

const defaultWorkspace: Workspace = {
  id: "personal",
  name: "شخصي",
  type: "personal",
  color: "#0A4EFF",
  memberCount: 1,
  members: [],
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [defaultWorkspace],
      activeWorkspaceId: "personal",

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      addWorkspace: (input) => {
        const workspace: Workspace = {
          ...input,
          id: "ws_" + Math.random().toString(36).slice(2, 12),
          members: [],
        };
        set((s) => ({ workspaces: [...s.workspaces, workspace] }));
        pushWorkspace(workspace);
        return workspace;
      },

      deleteWorkspace: (id) => {
        const { activeWorkspaceId, workspaces } = get();
        const target = workspaces.find((w) => w.id === id);
        if (target?.type === "personal") return;
        const fallback =
          workspaces.find((w) => w.type === "personal")?.id ?? workspaces[0]?.id ?? "personal";
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId: activeWorkspaceId === id ? fallback : activeWorkspaceId,
        }));
        syncDeleteWorkspace(id);
      },

      leaveWorkspace: (id) => {
        const { activeWorkspaceId, workspaces } = get();
        const target = workspaces.find((w) => w.id === id);
        if (target?.type === "personal") return;
        const fallback =
          workspaces.find((w) => w.type === "personal")?.id ?? workspaces[0]?.id ?? "personal";
        set((s) => ({
          workspaces: s.workspaces.filter((w) => w.id !== id),
          activeWorkspaceId: activeWorkspaceId === id ? fallback : activeWorkspaceId,
        }));
      },

      addMember: (workspaceId, member) => {
        const newMember: WorkspaceMember = {
          ...member,
          id: Math.random().toString(36).slice(2, 10),
          addedAt: new Date().toISOString(),
        };
        let updatedWs: Workspace | undefined;
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== workspaceId) return w;
            updatedWs = { ...w, members: [...w.members, newMember], memberCount: w.memberCount + 1 };
            return updatedWs;
          }),
        }));
        pushMember(newMember, workspaceId);
        if (updatedWs) pushWorkspace(updatedWs);
      },

      removeMember: (workspaceId, memberId) => {
        let updatedWs: Workspace | undefined;
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== workspaceId) return w;
            updatedWs = {
              ...w,
              members: w.members.filter((m) => m.id !== memberId),
              memberCount: Math.max(1, w.memberCount - 1),
            };
            return updatedWs;
          }),
        }));
        syncDeleteMember(memberId);
        if (updatedWs) pushWorkspace(updatedWs);
      },

      updateWorkspace: (id, patch) => {
        let updatedWs: Workspace | undefined;
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== id) return w;
            updatedWs = { ...w, ...patch };
            return updatedWs;
          }),
        }));
        if (updatedWs) pushWorkspace(updatedWs);
      },

      updateMemberRole: (workspaceId, memberId, role) => {
        let updatedWs: Workspace | undefined;
        let updatedMember: WorkspaceMember | undefined;
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== workspaceId) return w;
            updatedWs = {
              ...w,
              members: w.members.map((m) => {
                if (m.id !== memberId) return m;
                updatedMember = { ...m, role };
                return updatedMember;
              }),
            };
            return updatedWs;
          }),
        }));
        if (updatedMember) pushMember(updatedMember, workspaceId);
        if (updatedWs) pushWorkspace(updatedWs);
      },
    }),
    {
      name: "heed:workspaces",
      // Migrate old workspaces that don't have members array
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<WorkspaceState>;
        return {
          ...current,
          ...p,
          workspaces: (p.workspaces ?? [defaultWorkspace]).map((w) => ({
            ...w,
            members: (w as Workspace & { members?: WorkspaceMember[] }).members ?? [],
          })),
        };
      },
    }
  )
);
