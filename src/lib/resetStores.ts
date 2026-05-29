import { useTasksStore } from "../stores/tasksStore";
import { useScheduleStore } from "../stores/scheduleStore";
import { useMeetingsStore } from "../stores/meetingsStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSyncStatusStore } from "../stores/syncStatusStore";

// Wipes every persisted data store back to its initial empty state.
// Used when switching identity (sign-in / sign-out / different user)
// so one account never sees another account's local cache.
export function resetAllStores() {
  useTasksStore.setState({ tasks: [], projects: [], categories: [], tags: [] });
  useScheduleStore.setState({ posts: [] });
  useMeetingsStore.setState({ meetings: [] });
  useWorkspaceStore.setState({
    workspaces: [
      {
        id: "personal",
        name: "شخصي",
        type: "personal",
        color: "#0A4EFF",
        memberCount: 1,
        members: [],
      },
    ],
    activeWorkspaceId: "personal",
  });
  useSyncStatusStore.setState({
    state: "offline",
    pending: 0,
    lastSyncedAt: null,
    lastError: null,
  });
}
