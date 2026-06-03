import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/utils";

// =========================================================================
// Lightweight Markdown renderer — no external dependency.
// Handles the subset LLMs actually emit: fenced code blocks, inline code,
// bold / italic, links, headings, and bullet / numbered lists. Plain text
// falls through untouched. Good enough for a chat surface; swap for
// react-markdown later if richer rendering is needed.
// =========================================================================

export function Markdown({ text }: { text: string }) {
  const blocks = splitFences(text);
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <CodeBlock key={i} lang={b.lang} code={b.content} />
        ) : (
          <ProseBlock key={i} text={b.content} />
        )
      )}
    </div>
  );
}

// ── Code fences ────────────────────────────────────────────────────────────
type Segment = { type: "code"; lang: string; content: string } | { type: "text"; content: string };

function splitFences(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", content: text.slice(last, m.index) });
    out.push({ type: "code", lang: m[1] || "", content: m[2].replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", content: text.slice(last) });
  if (out.length === 0) out.push({ type: "text", content: text });
  return out;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div dir="ltr" className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/70">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <span className="font-micro text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-micro text-[10px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "اتنسخ" : "نسخ"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

// ── Prose (paragraphs / headings / lists) ───────────────────────────────────
function ProseBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    nodes.push(
      list.ordered ? (
        <ol key={nodes.length} className="ms-5 list-decimal space-y-1">
          {items.map((it, i) => <li key={i}>{inline(it)}</li>)}
        </ol>
      ) : (
        <ul key={nodes.length} className="ms-5 list-disc space-y-1">
          {items.map((it, i) => <li key={i}>{inline(it)}</li>)}
        </ul>
      )
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^(#{1,6})\s+(.*)$/);

    if (bullet) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(numbered[1]);
    } else if (heading) {
      flushList();
      const level = heading[1].length;
      nodes.push(
        <p key={nodes.length} className={cn("font-semibold", level <= 2 ? "text-base" : "text-sm")}>
          {inline(heading[2])}
        </p>
      );
    } else {
      flushList();
      nodes.push(<p key={nodes.length}>{inline(line)}</p>);
    }
  }
  flushList();
  return <>{nodes}</>;
}

// ── Inline formatting: `code`, **bold**, *italic*, [text](url) ──────────────
function inline(text: string): ReactNode[] {
  // Tokenise on the inline markers, preserving order.
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(re).filter((p) => p !== "");
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={i} dir="ltr" className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a
          key={i}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {link[1]}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
