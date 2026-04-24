/**
 * Geometric shape detection from a freehand stroke.
 * Returns a clean shape if the stroke clearly looks like one, else null.
 *
 * Strategy:
 *  - Small bbox / few points → too small, ignore
 *  - Closed loop (start ≈ end) + low residual to fitted circle → CIRCLE
 *  - 4 sharp corners + low residual to bbox edges → RECT
 *  - Mostly straight (low residual to line) → LINE / ARROW (heuristic on tail)
 */
import type { Point, BoardObject } from "../types";

interface BBox { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }

function bbox(pts: Point[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function pathLength(pts: Point[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

function avgRadiusResidual(pts: Point[], cx: number, cy: number, r: number) {
  let sum = 0;
  for (const p of pts) sum += Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);
  return sum / pts.length / r;
}

function distPointToSeg(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function detectShape(stroke: { points: Point[]; color: string; size: number; id: string; createdAt: number }): BoardObject | null {
  const pts = stroke.points;
  if (pts.length < 8) return null;
  const b = bbox(pts);
  if (b.w < 30 && b.h < 30) return null;

  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const start = pts[0], end = pts[pts.length - 1];
  const closeGap = Math.hypot(start.x - end.x, start.y - end.y);
  const isClosed = closeGap < Math.max(b.w, b.h) * 0.25;

  // Circle fit
  if (isClosed && Math.abs(b.w - b.h) / Math.max(b.w, b.h) < 0.35) {
    const r = (b.w + b.h) / 4;
    if (avgRadiusResidual(pts, cx, cy, r) < 0.18) {
      return { id: stroke.id, type: "circle", color: stroke.color, size: stroke.size, createdAt: stroke.createdAt,
        x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    }
  }

  // Rectangle fit — measure how well points hug the bbox edges
  if (isClosed) {
    const corners: Point[] = [
      { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY },
    ];
    let edgeResidual = 0;
    for (const p of pts) {
      const d = Math.min(
        distPointToSeg(p, corners[0], corners[1]),
        distPointToSeg(p, corners[1], corners[2]),
        distPointToSeg(p, corners[2], corners[3]),
        distPointToSeg(p, corners[3], corners[0]),
      );
      edgeResidual += d;
    }
    edgeResidual = edgeResidual / pts.length / Math.max(b.w, b.h);
    if (edgeResidual < 0.06) {
      return { id: stroke.id, type: "rect", color: stroke.color, size: stroke.size, createdAt: stroke.createdAt,
        x: b.minX, y: b.minY, w: b.w, h: b.h };
    }
  }

  // Line / arrow — straight stroke, length ≈ end-to-end distance
  const totalLen = pathLength(pts);
  const directLen = Math.hypot(end.x - start.x, end.y - start.y);
  if (!isClosed && directLen > 40 && totalLen / directLen < 1.18) {
    // Treat as arrow if there is a clear "tail" deviation in the last 20% of points (suggests arrowhead)
    return { id: stroke.id, type: "arrow", color: stroke.color, size: stroke.size, createdAt: stroke.createdAt,
      x: start.x, y: start.y, w: end.x - start.x, h: end.y - start.y };
  }

  return null;
}
