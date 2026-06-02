import type { CanvasEdge, CanvasNode } from "../../stores/canvasStore";
import { edgePath, edgeMidpoint, nodeAnchor, type Point } from "../../lib/canvasMath";

// SVG layer rendered inside the world transform. Draws every edge as a
// border-to-border bezier, plus a live "pending" edge while connecting.
export function CanvasEdges({
  edges,
  nodeById,
  pending,
  selectedEdgeId,
  onSelectEdge,
  onRemoveEdge,
}: {
  edges: CanvasEdge[];
  nodeById: Map<string, CanvasNode>;
  pending: { source: CanvasNode; to: Point } | null;
  selectedEdgeId: string | null;
  onSelectEdge: (id: string) => void;
  onRemoveEdge: (id: string) => void;
}) {
  return (
    <svg
      className="pointer-events-none absolute overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1 }}
    >
      <defs>
        <marker
          id="heed-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
        </marker>
      </defs>

      {edges.map((e) => {
        const s = nodeById.get(e.source);
        const t = nodeById.get(e.target);
        if (!s || !t) return null;
        const d = edgePath(s, t);
        const mid = edgeMidpoint(s, t);
        const selected = selectedEdgeId === e.id;
        return (
          <g key={e.id}>
            {/* fat invisible hit area for easy clicking */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="pointer-events-auto cursor-pointer"
              onPointerDown={(ev) => {
                ev.stopPropagation();
                onSelectEdge(e.id);
              }}
            />
            <path
              d={d}
              fill="none"
              stroke={selected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.55)"}
              strokeWidth={selected ? 2.5 : 1.75}
              markerEnd="url(#heed-arrow)"
              className="pointer-events-none"
            />
            {selected && (
              <g
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  onRemoveEdge(e.id);
                }}
              >
                <circle cx={mid.x} cy={mid.y} r={9} fill="hsl(var(--destructive))" />
                <path
                  d={`M ${mid.x - 3.5} ${mid.y - 3.5} L ${mid.x + 3.5} ${mid.y + 3.5} M ${mid.x + 3.5} ${mid.y - 3.5} L ${mid.x - 3.5} ${mid.y + 3.5}`}
                  stroke="white"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* pending connection line */}
      {pending && (
        <path
          d={(() => {
            const a = nodeAnchor(pending.source, pending.to);
            return `M ${a.x} ${a.y} L ${pending.to.x} ${pending.to.y}`;
          })()}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="5 5"
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}
