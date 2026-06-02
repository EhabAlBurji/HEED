import type { CanvasNode, Viewport } from "../stores/canvasStore";

export type Point = { x: number; y: number };

// Convert a screen-space point (relative to the canvas viewport element)
// into world-space coordinates, accounting for pan + zoom.
export function screenToWorld(pt: Point, viewport: Viewport): Point {
  return {
    x: (pt.x - viewport.x) / viewport.zoom,
    y: (pt.y - viewport.y) / viewport.zoom,
  };
}

// Center of a node in world space.
export function nodeCenter(n: CanvasNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

// The point on a node's bounding box edge in the direction of `toward`.
// Used so edges visually attach to the box border, not the center.
export function nodeAnchor(n: CanvasNode, toward: Point): Point {
  const c = nodeCenter(n);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = n.width / 2;
  const hh = n.height / 2;
  // scale the direction vector so it lands on the nearest box edge
  const scale = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

// SVG bezier path string between two nodes (border-to-border).
export function edgePath(source: CanvasNode, target: CanvasNode): string {
  const a = nodeAnchor(source, nodeCenter(target));
  const b = nodeAnchor(target, nodeCenter(source));
  const dx = Math.abs(b.x - a.x);
  // horizontal-ish control points give a smooth S-curve
  const c = Math.max(40, dx * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + c} ${a.y}, ${b.x - c} ${b.y}, ${b.x} ${b.y}`;
}

// Midpoint of an edge (for placing a delete affordance).
export function edgeMidpoint(source: CanvasNode, target: CanvasNode): Point {
  const a = nodeCenter(source);
  const b = nodeCenter(target);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export const clampZoom = (z: number) => Math.min(2, Math.max(0.25, z));
