import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pushMeeting, deleteMeeting as syncDeleteMeeting } from "../lib/sync";
import { useWorkspaceStore } from "./workspaceStore";

const activeWs = () => useWorkspaceStore.getState().activeWorkspaceId;

export type Meeting = {
  id: string;
  title: string;
  date: string;        // YYYY-MM-DD
  time: string | null; // HH:MM
  duration_minutes: number | null;
  location: string;
  notes: string;
  createdAt: string;
  source: "manual" | "google";
  externalId: string | null;
  workspace_id: string;
  attendees?: string[];       // display names from Google or manual entry
  meetingLink?: string | null; // Google Meet / Zoom / etc.
};

const uid = () => Math.random().toString(36).slice(2, 10);

type MeetingsState = {
  meetings: Meeting[];
  addMeeting: (input: Omit<Meeting, "id" | "createdAt" | "source" | "externalId" | "workspace_id"> & { workspace_id?: string }) => void;
  updateMeeting: (id: string, patch: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  upsertGoogleMeeting: (input: Omit<Meeting, "id" | "createdAt">) => void;
  removeGoogleMeetings: (keepIds: Set<string>) => void;
};

export const useMeetingsStore = create<MeetingsState>()(
  persist(
    (set) => ({
      meetings: [],

      addMeeting: (input) => {
        const meeting: Meeting = {
          ...input,
          workspace_id: input.workspace_id ?? activeWs(),
          source: "manual",
          externalId: null,
          id: uid(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ meetings: [...s.meetings, meeting] }));
        pushMeeting(meeting);
      },

      updateMeeting: (id, patch) => {
        let updated: Meeting | undefined;
        set((s) => ({
          meetings: s.meetings.map((m) => {
            if (m.id !== id) return m;
            updated = { ...m, ...patch };
            return updated;
          }),
        }));
        if (updated) pushMeeting(updated);
      },

      deleteMeeting: (id) => {
        set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
        syncDeleteMeeting(id);
      },

      upsertGoogleMeeting: (input) => {
        let result: Meeting | undefined;
        set((s) => {
          const existing = s.meetings.find(
            (m) => m.source === "google" && m.externalId === input.externalId
          );
          if (existing) {
            result = { ...existing, ...input };
            return {
              meetings: s.meetings.map((m) => (m.id === existing.id ? (result as Meeting) : m)),
            };
          }
          result = { ...input, id: uid(), createdAt: new Date().toISOString() };
          return { meetings: [...s.meetings, result] };
        });
        if (result) pushMeeting(result);
      },

      removeGoogleMeetings: (keepIds) => {
        const removed: string[] = [];
        set((s) => ({
          meetings: s.meetings.filter((m) => {
            if (m.source !== "google") return true;
            if (keepIds.size === 0) { removed.push(m.id); return false; }
            if (keepIds.has(m.externalId ?? "")) return true;
            removed.push(m.id);
            return false;
          }),
        }));
        removed.forEach(syncDeleteMeeting);
      },
    }),
    {
      name: "heed:meetings",
      version: 4,
      migrate: (state: unknown, version: number | undefined) => {
        const s = state as Record<string, unknown>;
        const v = version ?? 0;
        if (v < 2) {
          return {
            ...s,
            meetings: ((s.meetings as Meeting[]) ?? []).map((m) => ({
              ...m,
              source: "manual" as const,
              externalId: null,
              workspace_id: "personal",
              attendees: [],
              meetingLink: null,
            })),
          };
        }
        if (v < 3) {
          return {
            ...s,
            meetings: ((s.meetings as Meeting[]) ?? []).map((m) => ({
              ...m,
              workspace_id: (m as Record<string, unknown>).workspace_id ?? "personal",
              attendees: [],
              meetingLink: null,
            })),
          };
        }
        if (v < 4) {
          return {
            ...s,
            meetings: ((s.meetings as Meeting[]) ?? []).map((m) => ({
              ...m,
              attendees: (m as Record<string, unknown>).attendees ?? [],
              meetingLink: (m as Record<string, unknown>).meetingLink ?? null,
            })),
          };
        }
        return s;
      },
    }
  )
);
