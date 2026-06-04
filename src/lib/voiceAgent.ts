import i18n from "./i18n";
import { useTasksStore } from "../stores/tasksStore";
import { useCanvasStore } from "../stores/canvasStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useNotificationsStore } from "../stores/notificationsStore";
import { streamAssistant } from "./chatActions";
import type { ChatMessage } from "./chatProviders";

// =========================================================================
// HEED voice agent — turns a spoken request into ONE concrete action.
// The transcript is sent to the model, which replies with a small JSON
// action spec; we parse it and execute it against the local stores, then
// drop a success notification. Uses the existing chat provider (no new
// backend), so it works the moment the chat proxy is live.
// =========================================================================

export type AgentResult = { ok: boolean; message: string };

type ActionSpec = {
  action: "create_task" | "create_reminder" | "create_project" | "create_board" | "none";
  title?: string;
  name?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  deadline?: string | null;
  reply?: string;
};

function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    "You are Heed's voice agent. The user speaks a request; turn it into ONE action.",
    "Reply with ONLY a JSON object (no prose, no markdown fence) shaped exactly like:",
    '{"action":"create_task|create_reminder|create_project|create_board|none","title":"...","name":"...","priority":"low|medium|high|urgent","deadline":"YYYY-MM-DD or null","reply":"short friendly confirmation"}',
    "Rules:",
    "- create_task / create_reminder use \"title\"; create_project / create_board use \"name\".",
    "- Infer priority and deadline only if the user mentions them; otherwise priority=\"medium\", deadline=null.",
    '- "reply" MUST be in the SAME language the user spoke (Egyptian Arabic if they spoke Arabic).',
    '- If the request is not a clear actionable command, use action "none" and put a helpful sentence in "reply".',
    `Today's date is ${today}.`,
  ].join("\n");
}

export async function runVoiceAgent(transcript: string): Promise<AgentResult> {
  const text = transcript.trim();
  if (!text) return { ok: false, message: i18n.language === "en" ? "I didn't catch that." : "مش سامعك، جرّب تاني." };

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: text },
  ];

  let raw = "";
  try {
    await streamAssistant(messages, (d) => { raw += d; });
  } catch (e) {
    return { ok: false, message: (e as Error).message || (i18n.language === "en" ? "Agent failed." : "حصل خطأ.") };
  }

  const spec = parseAction(raw);
  if (!spec) return { ok: false, message: i18n.language === "en" ? "I couldn't understand that as an action." : "مش فاهم الطلب، جرّب تاني." };
  return execute(spec);
}

function parseAction(raw: string): ActionSpec | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? raw.match(/\{[\s\S]*\}/)?.[0] ?? "").trim();
  if (!candidate) return null;
  try {
    const obj = JSON.parse(candidate);
    return obj && typeof obj.action === "string" ? (obj as ActionSpec) : null;
  } catch {
    return null;
  }
}

function execute(spec: ActionSpec): AgentResult {
  const isEn = i18n.language === "en";
  const notify = (title: string, body: string) =>
    useNotificationsStore.getState().add({ type: "info", title, body });

  switch (spec.action) {
    case "create_task":
    case "create_reminder": {
      const title = (spec.title || spec.name || "").trim();
      if (!title) return { ok: false, message: isEn ? "What should the task be?" : "المهمة تكون إيه؟" };
      useTasksStore.getState().addTask({
        title,
        priority: spec.priority ?? (spec.action === "create_reminder" ? "high" : "medium"),
        deadline: spec.deadline ?? null,
        column: "today",
      });
      const msg = spec.reply || (isEn ? `Added: ${title}` : `اتسجّلت: ${title}`);
      notify(isEn ? "✅ Task created" : "✅ تم تسجيل المهمة", msg);
      return { ok: true, message: msg };
    }
    case "create_project": {
      const name = (spec.name || spec.title || "").trim();
      if (!name) return { ok: false, message: isEn ? "What's the project name?" : "اسم المشروع إيه؟" };
      useTasksStore.getState().addProject({
        name, color: "#4285F4", icon: name[0]?.toUpperCase() ?? "P", type: "general",
        workspace_id: useWorkspaceStore.getState().activeWorkspaceId,
      });
      const msg = spec.reply || (isEn ? `Project created: ${name}` : `اتعمل مشروع: ${name}`);
      notify(isEn ? "✅ Project created" : "✅ تم إنشاء المشروع", msg);
      return { ok: true, message: msg };
    }
    case "create_board": {
      const name = (spec.name || spec.title || "").trim();
      useCanvasStore.getState().addBoard(name || undefined);
      const msg = spec.reply || (isEn ? `Board created: ${name}` : `اتعمل بورد: ${name}`);
      notify(isEn ? "✅ Board created" : "✅ تم إنشاء البورد", msg);
      return { ok: true, message: msg };
    }
    default:
      return { ok: false, message: spec.reply || (isEn ? "Not sure what to do with that." : "مش متأكد أعمل إيه بالطلب ده.") };
  }
}
