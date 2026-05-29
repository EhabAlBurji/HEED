import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── File paths ──────────────────────────────────────────────────────────────
const DATA_DIR = join(homedir(), "Library", "Application Support", "app.heed");
const DATA_FILE = join(DATA_DIR, "mcp-data.json");
const COMMANDS_FILE = join(DATA_DIR, "mcp-commands.json");

function readData() {
  if (!existsSync(DATA_FILE)) {
    return { tasks: [], projects: [], categories: [], scheduledPosts: [], updatedAt: null };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function queueCommand(type, payload) {
  mkdirSync(DATA_DIR, { recursive: true });
  let queue = [];
  if (existsSync(COMMANDS_FILE)) {
    try { queue = JSON.parse(readFileSync(COMMANDS_FILE, "utf8")); } catch {}
  }
  queue.push({
    id: Math.random().toString(36).slice(2, 10),
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
  writeFileSync(COMMANDS_FILE, JSON.stringify(queue, null, 2));
}

// ── Tool definitions ────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "get_tasks",
    description: "Get tasks from Heed. Optionally filter by status or priority.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "cancelled"],
          description: "Filter by task status",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Filter by priority",
        },
        today_only: {
          type: "boolean",
          description: "Return only tasks with column=today",
        },
      },
    },
  },
  {
    name: "create_task",
    description: "Create a new task in Heed.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "Task title" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          default: "medium",
        },
        estimated_minutes: { type: "number", description: "Estimated time in minutes" },
        deadline: { type: "string", description: "Deadline date (YYYY-MM-DD)" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "complete_task",
    description: "Mark a task as done.",
    inputSchema: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string", description: "The task's id field" },
      },
    },
  },
  {
    name: "update_task",
    description: "Update a task's properties (priority, deadline, notes, status, etc.).",
    inputSchema: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        status: { type: "string", enum: ["todo", "in_progress", "done", "cancelled"] },
        estimated_minutes: { type: "number" },
        deadline: { type: "string" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "get_schedule",
    description: "Get the publish schedule from Heed.",
    inputSchema: {
      type: "object",
      properties: {
        column: {
          type: "string",
          enum: ["content", "this_week", "today", "published"],
          description: "Filter by schedule column",
        },
      },
    },
  },
  {
    name: "add_to_schedule",
    description: "Add a content piece to the publish schedule.",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string" },
        platform: {
          type: "string",
          enum: ["YouTube", "Instagram", "TikTok", "Twitter", "Facebook", "LinkedIn", "Other"],
        },
        scheduled_date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
        column: {
          type: "string",
          enum: ["content", "this_week", "today", "published"],
          default: "content",
        },
      },
    },
  },
  {
    name: "get_summary",
    description: "Get a quick summary of today's tasks and upcoming scheduled posts.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Tool handlers ────────────────────────────────────────────────────────────
function handleTool(name, args) {
  const data = readData();

  switch (name) {
    case "get_tasks": {
      let tasks = data.tasks ?? [];
      if (args.status) tasks = tasks.filter((t) => t.status === args.status);
      if (args.priority) tasks = tasks.filter((t) => t.priority === args.priority);
      if (args.today_only) tasks = tasks.filter((t) => t.column === "today");
      return {
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          column: t.column,
          estimated_minutes: t.estimated_minutes,
          actual_minutes: t.actual_minutes,
          deadline: t.deadline,
          video_stage: t.video_stage,
        })),
      };
    }

    case "create_task": {
      queueCommand("create_task", {
        title: args.title,
        priority: args.priority ?? "medium",
        estimated_minutes: args.estimated_minutes ?? null,
        deadline: args.deadline ?? null,
        notes: args.notes ?? "",
      });
      return { queued: true, message: `Task "${args.title}" queued for creation. It will appear in Heed within a few seconds.` };
    }

    case "complete_task": {
      const task = (data.tasks ?? []).find((t) => t.id === args.task_id);
      if (!task) return { error: `Task ${args.task_id} not found` };
      queueCommand("complete_task", { task_id: args.task_id });
      return { queued: true, message: `Task "${task.title}" marked as done.` };
    }

    case "update_task": {
      const { task_id, ...updates } = args;
      const task = (data.tasks ?? []).find((t) => t.id === task_id);
      if (!task) return { error: `Task ${task_id} not found` };
      queueCommand("update_task", { task_id, ...updates });
      return { queued: true, message: `Task "${task.title}" updated.` };
    }

    case "get_schedule": {
      let posts = data.scheduledPosts ?? [];
      if (args.column) posts = posts.filter((p) => p.column === args.column);
      return {
        count: posts.length,
        posts: posts.map((p) => ({
          id: p.id,
          title: p.title,
          platform: p.platform,
          scheduledDate: p.scheduledDate,
          column: p.column,
          notes: p.notes,
        })),
      };
    }

    case "add_to_schedule": {
      queueCommand("add_to_schedule", {
        title: args.title,
        platform: args.platform ?? "",
        scheduled_date: args.scheduled_date ?? null,
        notes: args.notes ?? "",
        column: args.column ?? "content",
      });
      return { queued: true, message: `"${args.title}" added to publish schedule.` };
    }

    case "get_summary": {
      const today = new Date().toISOString().slice(0, 10);
      const todayTasks = (data.tasks ?? []).filter((t) => t.column === "today" && t.status !== "done");
      const doneTodayCount = (data.tasks ?? []).filter(
        (t) => t.completed_at?.slice(0, 10) === today
      ).length;
      const todayPosts = (data.scheduledPosts ?? []).filter(
        (p) => p.column === "today" || p.scheduledDate === today
      );
      const weekPosts = (data.scheduledPosts ?? []).filter((p) => p.column === "this_week");
      return {
        today_tasks_remaining: todayTasks.length,
        today_tasks_done: doneTodayCount,
        today_tasks: todayTasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
        publish_today: todayPosts.map((p) => ({ id: p.id, title: p.title, platform: p.platform })),
        publish_this_week: weekPosts.map((p) => ({ id: p.id, title: p.title, platform: p.platform, scheduledDate: p.scheduledDate })),
        data_last_updated: data.updatedAt,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Server setup ─────────────────────────────────────────────────────────────
const server = new Server(
  { name: "heed", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = handleTool(name, args ?? {});
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
