import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, Trash2 } from "lucide-react";
import { useTasksStore } from "../../stores/tasksStore";
import { useAuthStore } from "../../stores/authStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { notifyMention, pushComment, removeCommentServer, watchTaskComments } from "../../lib/teamSync";

// Monday/Wrike-style comment thread for a task: activity line + comments +
// an input that supports @mentions of workspace members.
export function TaskComments({ taskId, workspaceId }: { taskId: string; workspaceId: string }) {
  const { t } = useTranslation();
  const comments = useTasksStore((s) => s.comments);
  const addComment = useTasksStore((s) => s.addComment);
  const deleteComment = useTasksStore((s) => s.deleteComment);
  const task = useTasksStore((s) => s.tasks.find((t) => t.id === taskId));
  const user = useAuthStore((s) => s.user);
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  const members = useMemo(() => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    return ws?.members ?? [];
  }, [workspaces, workspaceId]);

  const thread = useMemo(
    () => comments.filter((c) => c.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments, taskId]
  );

  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load + live-subscribe this task's comments from the server (no-op offline).
  useEffect(() => watchTaskComments(taskId), [taskId]);

  const onChange = (val: string) => {
    setText(val);
    // detect a trailing "@token" to drive the mention popup
    const m = val.match(/@(\w*)$/);
    setMentionQuery(m ? m[1] : null);
  };

  const pickMention = (name: string) => {
    setText((t) => t.replace(/@(\w*)$/, `@${name} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const send = () => {
    const body = text.trim();
    if (!body || !user) return;
    const created = addComment({
      task_id: taskId,
      workspace_id: workspaceId,
      author_id: user.id,
      author_name: user.name || user.email || "Me",
      author_avatar: user.avatarUrl ?? null,
      body,
    });
    void pushComment(created); // sync to other members (no-op offline)
    // Notify mentioned members via the backend (routes to their device). No-op offline.
    const mentioned = new Set((body.match(/@(\w[\w-]*)/g) ?? []).map((m) => m.slice(1).toLowerCase()));
    members.forEach((m) => {
      if (mentioned.has(m.name.toLowerCase()) && m.id !== user.id) {
        void notifyMention(workspaceId, m.name, task?.title ?? "", taskId);
      }
    });
    setText("");
    setMentionQuery(null);
  };

  const mentionMatches =
    mentionQuery !== null
      ? members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : [];

  return (
    <div className="space-y-3">
      <p className="font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
        {t("comments.title")}
      </p>

      {/* Activity: task created */}
      {task && (
        <div className="flex items-center gap-2 font-micro text-[11px] text-muted-foreground/70">
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
          {t("comments.created")} · {new Date(task.created_at).toLocaleDateString()}
        </div>
      )}

      {/* Comments */}
      <div className="space-y-3">
        {thread.map((c) => (
          <div key={c.id} className="group/c flex gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {c.author_avatar ? (
                <img src={c.author_avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (c.author_name[0] ?? "?").toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium">{c.author_name}</span>
                <span className="font-micro text-[10px] text-muted-foreground/60">
                  {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => {
                    deleteComment(c.id);
                    void removeCommentServer(c.id);
                  }}
                  className="ms-auto opacity-0 transition group-hover/c:opacity-100"
                  title={t("comments.delete")}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderBody(c.body)}</p>
            </div>
          </div>
        ))}
        {thread.length === 0 && (
          <p className="font-micro text-xs text-muted-foreground/50">{t("comments.none")}</p>
        )}
      </div>

      {/* Composer */}
      <div className="relative rounded-xl border border-border/60 bg-background/40 p-2">
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-full mb-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-border/60 bg-card p-1 shadow-2xl">
            {mentionMatches.map((m) => (
              <button
                key={m.id}
                onClick={() => pickMention(m.name)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-secondary"
              >
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {(m.name[0] ?? "?").toUpperCase()}
                </span>
                {m.name}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={t("comments.placeholder")}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
        <div className="flex items-center justify-between">
          <span className="font-micro text-[10px] text-muted-foreground/50">{t("comments.sendHint")}</span>
          <button
            onClick={send}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            {t("comments.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Highlight @mentions inside a comment body.
function renderBody(body: string) {
  const parts = body.split(/(@\w[\w-]*)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="font-medium text-primary">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
