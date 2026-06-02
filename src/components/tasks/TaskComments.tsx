import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, ImagePlus, Mic, Paperclip, Send, Square, Trash2, Video, X } from "lucide-react";
import { useTasksStore, type CommentAttachment } from "../../stores/tasksStore";
import { useAuthStore } from "../../stores/authStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { fileToStorableDataUrl } from "../../lib/imageCompress";
import { notifyMention, pushComment, removeCommentServer, watchTaskComments } from "../../lib/teamSync";

const readDataUrl = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });

// Monday/Wrike-style comment thread for a task: comments + an input that
// supports @mentions of project members and attachments (image / video / file
// / voice note).
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
  const [pending, setPending] = useState<CommentAttachment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => watchTaskComments(taskId), [taskId]);
  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length]);

  const onChange = (val: string) => {
    setText(val);
    const m = val.match(/@(\w*)$/);
    setMentionQuery(m ? m[1] : null);
  };

  const pickMention = (name: string) => {
    setText((t) => t.replace(/@(\w*)$/, `@${name} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const addImage = async (f: File) => {
    const src = await fileToStorableDataUrl(f);
    setPending((p) => [...p, { kind: "image", src, name: f.name }]);
  };
  const addVideo = async (f: File) => {
    const src = await readDataUrl(f);
    setPending((p) => [...p, { kind: "video", src, name: f.name }]);
  };
  const addFile = async (f: File) => {
    const src = await readDataUrl(f);
    setPending((p) => [...p, { kind: "file", src, name: f.name }]);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        const src = await readDataUrl(new File([blob], "voice", { type: blob.type }));
        setPending((p) => [...p, { kind: "voice", src }]);
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch {
      /* mic denied */
    }
  };
  const stopRec = () => {
    recRef.current?.stop();
    setRecording(false);
  };

  const send = () => {
    const body = text.trim();
    if ((!body && pending.length === 0) || !user) return;
    const created = addComment({
      task_id: taskId,
      workspace_id: workspaceId,
      author_id: user.id,
      author_name: user.name || user.email || "Me",
      author_avatar: user.avatarUrl ?? null,
      body,
      attachments: pending.length ? pending : undefined,
    });
    void pushComment(created);
    const mentioned = new Set((body.match(/@(\w[\w-]*)/g) ?? []).map((m) => m.slice(1).toLowerCase()));
    members.forEach((m) => {
      if (mentioned.has(m.name.toLowerCase()) && m.id !== user.id) {
        void notifyMention(workspaceId, m.name, task?.title ?? "", taskId);
      }
    });
    setText("");
    setPending([]);
    setMentionQuery(null);
  };

  const mentionMatches =
    mentionQuery !== null
      ? members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
      : [];

  return (
    <div className="flex h-full flex-col">
      <p className="mb-3 font-micro text-[11px] uppercase tracking-widest text-muted-foreground">
        {t("comments.title")}
      </p>

      {/* Thread */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-1">
        {task && (
          <div className="flex items-center gap-2 font-micro text-[11px] text-muted-foreground/70">
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            {t("comments.created")} · {new Date(task.created_at).toLocaleDateString()}
          </div>
        )}
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
              {c.body && (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{renderBody(c.body)}</p>
              )}
              {c.attachments && c.attachments.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {c.attachments.map((a, i) => (
                    <Attachment key={i} a={a} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thread.length === 0 && (
          <p className="font-micro text-xs text-muted-foreground/50">{t("comments.none")}</p>
        )}
      </div>

      {/* Composer */}
      <div className="relative mt-2 rounded-xl border border-border/60 bg-background/40 p-2">
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

        {/* Staged attachments */}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a, i) => (
              <div key={i} className="relative">
                <Attachment a={a} small />
                <button
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  className="absolute -end-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
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

        <div className="flex items-center gap-1">
          <ToolBtn title={t("comments.attachImage")} onClick={() => imgRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn title={t("comments.attachVideo")} onClick={() => vidRef.current?.click()}>
            <Video className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn title={t("comments.attachFile")} onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </ToolBtn>
          {recording ? (
            <button
              onClick={stopRec}
              className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2 py-1 text-[11px] font-medium text-white"
            >
              <Square className="h-3 w-3 fill-current" />
              {t("comments.stopRec")}
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            </button>
          ) : (
            <ToolBtn title={t("comments.recordVoice")} onClick={() => void startRec()}>
              <Mic className="h-4 w-4" />
            </ToolBtn>
          )}

          <button
            onClick={send}
            disabled={!text.trim() && pending.length === 0}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
            {t("comments.send")}
          </button>
        </div>

        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImage(f); e.target.value = ""; }} />
        <input ref={vidRef} type="file" accept="video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void addVideo(f); e.target.value = ""; }} />
        <input ref={fileRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
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

function Attachment({ a, small }: { a: CommentAttachment; small?: boolean }) {
  const box = small ? "h-16 w-16" : "max-h-52 max-w-[260px]";
  if (a.kind === "image") {
    return <img src={a.src} alt={a.name ?? ""} className={`${box} rounded-lg border border-border/60 object-cover`} />;
  }
  if (a.kind === "video") {
    return <video src={a.src} controls className={`${small ? "h-16 w-24" : "max-h-52 max-w-[280px]"} rounded-lg border border-border/60 bg-black`} />;
  }
  if (a.kind === "voice") {
    return <audio src={a.src} controls className={small ? "h-9 w-40" : "w-60"} />;
  }
  return (
    <a
      href={a.src}
      download={a.name ?? "file"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary"
    >
      <FileText className="h-3.5 w-3.5 text-primary" />
      <span className="max-w-[140px] truncate">{a.name ?? "file"}</span>
    </a>
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
