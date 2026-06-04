// Local data backup — gathers every persisted Heed data store into one JSON
// file the user can download before a reset. Auth/session keys are deliberately
// excluded (they hold tokens and would be meaningless to restore).
const BACKUP_KEYS = [
  "heed:tasks",
  "heed:canvas",
  "heed:schedule",
  "heed:meetings",
  "heed:workspaces",
  "heed:notifications",
  "heed:chat",
  "heed:ui",
] as const;

export function buildBackup() {
  const data: Record<string, unknown> = {};
  for (const key of BACKUP_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw; // keep the raw string if it isn't valid JSON
    }
  }
  return {
    app: "Heed",
    kind: "local-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// Builds the backup and triggers a browser download as a timestamped .json file.
export function downloadBackup() {
  const json = JSON.stringify(buildBackup(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `heed-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
