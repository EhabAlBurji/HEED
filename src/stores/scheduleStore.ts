import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pushPost, deletePost as syncDeletePost } from "../lib/sync";
import { useWorkspaceStore } from "./workspaceStore";

const activeWs = () => useWorkspaceStore.getState().activeWorkspaceId;

export type ScheduleColumn = "content" | "this_week" | "today" | "published";

export type ScheduledPost = {
  id: string;
  title: string;
  notes: string;
  platforms: string[];       // multi-platform
  scheduledDate: string | null; // "MM-DD" (no year)
  scheduledTime: string | null; // "HH:MM"
  tags: string[];
  column: ScheduleColumn;
  position: number;
  createdAt: string;
  taskId: string | null;
  links: Array<{ label: string; url: string }>;
  previewImageUrl: string | null;
  workspace_id: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);

type ScheduleState = {
  posts: ScheduledPost[];
  addPost: (input: Omit<ScheduledPost, "id" | "createdAt">) => void;
  updatePost: (id: string, updates: Partial<ScheduledPost>) => void;
  removePost: (id: string) => void;
  movePost: (id: string, column: ScheduleColumn, position: number) => void;
};

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      posts: [],

      addPost: (input) => {
        const post: ScheduledPost = {
          ...input,
          links: input.links ?? [],
          previewImageUrl: input.previewImageUrl ?? null,
          workspace_id: input.workspace_id ?? activeWs(),
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ posts: [...s.posts, post] }));
        pushPost(post);
      },

      updatePost: (id, updates) => {
        let updated: ScheduledPost | undefined;
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== id) return p;
            updated = { ...p, ...updates };
            return updated;
          }),
        }));
        if (updated) pushPost(updated);
      },

      removePost: (id) => {
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
        syncDeletePost(id);
      },

      movePost: (id, column, position) => {
        let updated: ScheduledPost | undefined;
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== id) return p;
            updated = { ...p, column, position };
            return updated;
          }),
        }));
        if (updated) pushPost(updated);
      },
    }),
    {
      name: "heed:schedule",
      version: 5,
      migrate: (state: unknown, version: number | undefined) => {
        const s = state as Record<string, unknown>;
        const v = version ?? 0;
        if (v < 2) {
          const posts = ((s.posts as ScheduledPost[]) ?? []).map((p: unknown) => {
            const post = p as Record<string, unknown>;
            return {
              ...post,
              platforms: post.platforms
                ? post.platforms
                : post.platform
                  ? [post.platform as string]
                  : [],
              scheduledTime: post.scheduledTime ?? null,
              tags: post.tags ?? [],
              links: [],
              previewImageUrl: null,
            };
          });
          return { ...s, posts };
        }
        if (v < 3) {
          const posts = ((s.posts as ScheduledPost[]) ?? []).map((p: unknown) => {
            const post = p as Record<string, unknown>;
            return {
              ...post,
              links: post.links ?? [],
              previewImageUrl: post.previewImageUrl ?? null,
            };
          });
          return { ...s, posts };
        }
        if (v < 4) {
          const posts = ((s.posts as ScheduledPost[]) ?? []).map((p: unknown) => {
            const post = p as Record<string, unknown>;
            return { ...post, workspace_id: post.workspace_id ?? "personal" };
          });
          return { ...s, posts };
        }
        return s;
      },
    }
  )
);
