import { useWorkspaceStore } from "../stores/workspaceStore";
import { useNotificationsStore } from "../stores/notificationsStore";
import { acceptInviteServer, removeNotificationServer } from "./teamSync";
import { pullAll } from "./sync";

// Accept a workspace invite from a notification: add the workspace locally,
// switch to it, join server-side (RLS), then pull so its existing data loads.
export async function acceptWorkspaceInvite(
  notifId: string,
  ws: { id: string; name: string; color: string }
): Promise<void> {
  useWorkspaceStore.setState((s) => ({
    workspaces: s.workspaces.some((w) => w.id === ws.id)
      ? s.workspaces
      : [...s.workspaces, { id: ws.id, name: ws.name, type: "team", color: ws.color, memberCount: 1, members: [] }],
  }));
  useWorkspaceStore.getState().setActiveWorkspace(ws.id);
  useNotificationsStore.getState().remove(notifId);
  void removeNotificationServer(notifId);
  await acceptInviteServer(ws.id);
  void pullAll();
}

export function rejectWorkspaceInvite(notifId: string): void {
  void removeNotificationServer(notifId);
  useNotificationsStore.getState().remove(notifId);
}
