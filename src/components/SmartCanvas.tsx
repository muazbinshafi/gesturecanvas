/**
 * SmartCanvas — vector-based drawing surface.
 *
 * Uses two canvases: a static "committed" layer (only redrawn on change)
 * and a live "in-progress" layer that redraws each frame. This keeps the
 * RAF loop cheap and lag-free for long boards.
 *
 * Accepts both pointer events (mouse/touch/pen) and gesture events
 * forwarded by the parent. Same tool pipeline either way.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import type { BoardData, BoardObject, Point, ShapeObject, StrokeObject, TextObject, Tool } from "@/lib/types";
import { detectShape } from "@/lib/ink/heuristics";
import { recognizeInkAI } from "@/lib/ink/ai";

export interface SmartCanvasHandle {
  exportPNG: (background?: string) => Promise<Blob | null>;
  exportData: () => BoardData;
  loadData: (d: BoardData) => void;
  clear: () => void;
  undo: () => void;
  applyGestureCursor: (pose: string, cursor: { x: number; y: number } | null) => void;
}

interface Props {
  tool: Tool;
  color: string;
  size: number;
  smartInkMode: "off" | "heuristics" | "auto";
  online: boolean;
  readOnly?: boolean;
  initialData?: BoardData;
  onChange?: (data: BoardData) => void;
}

export const SmartCanvas = forwardRef<SmartCanvasHandle, Props>(function SmartCanvas(
  { tool, color, size, smartInkMode, online, readOnly, initialData, onChange }, ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const objectsRef = useRef<BoardObject[]>(initialData?.objects ?? []);
  const drawingRef = useRef<{ id: string; points: Point[] } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<BoardObject[][]>([]);
  const gestureDownRef = useRef(false);
  const lastGestureCursorRef = useRef<{ x: number; y: number } | null>(null);

  // Resize
  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current; if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width));
      const h = Math.max(320, Math.floor(r.height));
      setDims({ w, h });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { redrawBase(); /* eslint-disable-next-line */ }, [dims.w, dims.h]);

  function pushUndo() { undoStackRef.current.push(objectsRef.current.map((o) => ({ ...o }))); if (undoStackRef.current.length > 50) undoStackRef.current.shift(); }
  function commit() { onChange?.({ version: 1, objects: objectsRef.current, width: dims.w, height: dims.h }); redrawBase(); }

  function redrawBase() {
    const c = baseRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + "px"; c.style.height = dims.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dims.w, dims.h);
    for (const o of objectsRef.current) drawObject(ctx, o);
  }

  function redrawLive() {
    const c = liveRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = dims.w * dpr; c.height = dims.h * dpr;
    c.style.width = dims.w + "px"; c.style.height = dims.h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, dims.w, dims.h);
    const d = drawingRef.current;
    if (d) {
      drawStrokePath(ctx, d.points, color, size);
    }
    // Live cursor for gestures
    const g = lastGestureCursorRef.current;
    if (g) {
      ctx.beginPath();
      ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "hsl(265 89% 70%)"; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  // RAF loop for live layer
  useEffect(() => {
    let raf = 0;
    const step = () => { redrawLive(); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [dims.w, dims.h, color, size]);

  const startAt = useCallback((x: number, y: number) => {
    if (readOnly) return;
    if (tool === "pen") {
      const id = Math.random().toString(36).slice(2);
      drawingRef.current = { id, points: [{ x, y, p: 0.5 }] };
    } else if (tool === "rect" || tool === "circle" || tool === "arrow") {
      shapeStartRef.current = { x, y };
    } else if (tool === "eraser") {
      eraseAt(x, y);
    } else if (tool === "text") {
      const t = window.prompt("Text:");
      if (t) {
        pushUndo();
        const obj: TextObject = { id: Math.random().toString(36).slice(2), type: "text", x, y, text: t, color, size: Math.max(14, size * 4), createdAt: Date.now() };
        objectsRef.current = [...objectsRef.current, obj];
        commit();
      }
    }
  }, [tool, color, size, readOnly]);

  const moveAt = useCallback((x: number, y: number) => {
    if (drawingRef.current) drawingRef.current.points.push({ x, y, p: 0.5 });
    if (shapeStartRef.current) {
      // live preview drawn via redrawLive — temp shape stored on ref
      const s = shapeStartRef.current;
      const ctx = liveRef.current?.getContext("2d"); if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, dims.w, dims.h);
      drawShape(ctx, tool as "rect" | "circle" | "arrow", s.x, s.y, x - s.x, y - s.y, color, size);
    }
    if (tool === "eraser" && gestureDownRef.current) eraseAt(x, y);
  }, [tool, color, size, dims.w, dims.h]);

  const endAt = useCallback(async (x: number, y: number) => {
    const d = drawingRef.current;
    if (d && d.points.length > 1) {
      pushUndo();
      const stroke: StrokeObject = { id: d.id, type: "stroke", points: d.points, color, size, createdAt: Date.now() };
      // Smart Ink: try heuristics → AI
      let replaced: BoardObject | null = null;
      if (smartInkMode !== "off") {
        replaced = detectShape({ points: d.points, color, size, id: d.id, createdAt: stroke.createdAt });
        if (!replaced && smartInkMode === "auto" && online && d.points.length > 12) {
          // Rasterize stroke to PNG and ask AI (best-effort, non-blocking via await)
          const dataUrl = await rasterizeStrokeToPNG(d.points, color, size);
          if (dataUrl) {
            const ai = await recognizeInkAI(dataUrl);
            if (ai && ai.confidence > 0.6) {
              if (ai.kind === "shape") {
                replaced = detectShape({ points: d.points, color, size, id: d.id, createdAt: stroke.createdAt }) ?? null;
              } else if (ai.kind === "text" || ai.kind === "equation") {
                const minX = Math.min(...d.points.map((p) => p.x));
                const minY = Math.min(...d.points.map((p) => p.y));
                replaced = { id: d.id, type: "text", x: minX, y: minY, text: ai.value, color, size: 18, createdAt: stroke.createdAt } as TextObject;
              }
            }
          }
        }
      }
      objectsRef.current = [...objectsRef.current, replaced ?? stroke];
      commit();
    }
    drawingRef.current = null;
    if (shapeStartRef.current) {
      const s = shapeStartRef.current;
      const w = x - s.x, h = y - s.y;
      if (Math.abs(w) > 4 || Math.abs(h) > 4) {
        pushUndo();
        const obj: ShapeObject = { id: Math.random().toString(36).slice(2), type: tool as "rect" | "circle" | "arrow", x: s.x, y: s.y, w, h, color, size, createdAt: Date.now() };
        objectsRef.current = [...objectsRef.current, obj];
        commit();
      }
      shapeStartRef.current = null;
    }
  }, [tool, color, size, smartInkMode, online]);

  function eraseAt(x: number, y: number) {
    const r = Math.max(10, size * 3);
    const before = objectsRef.current.length;
    objectsRef.current = objectsRef.current.filter((o) => !hitTest(o, x, y, r));
    if (objectsRef.current.length !== before) { pushUndo(); commit(); }
  }

  // Pointer handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    startAt(e.clientX - r.left, e.clientY - r.top);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    moveAt(e.clientX - r.left, e.clientY - r.top);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    endAt(e.clientX - r.left, e.clientY - r.top);
  };

  // Gesture cursor input — parent calls applyGestureCursor every frame.
  // We emulate pointer down/up based on the current Pose.
  const applyGestureCursor = useCallback((pose: string, cursor: { x: number; y: number } | null) => {
    lastGestureCursorRef.current = cursor;
    if (!cursor) {
      if (gestureDownRef.current) { endAt(0, 0); gestureDownRef.current = false; }
      return;
    }
    const isDrawing = pose === "DRAW" && tool === "pen";
    const isErasing = pose === "ERASE" && (tool === "eraser" || true);
    const wantsDown = isDrawing || isErasing;
    if (wantsDown && !gestureDownRef.current) {
      gestureDownRef.current = true;
      if (isDrawing) startAt(cursor.x, cursor.y);
      if (isErasing) eraseAt(cursor.x, cursor.y);
    } else if (wantsDown && gestureDownRef.current) {
      moveAt(cursor.x, cursor.y);
    } else if (!wantsDown && gestureDownRef.current) {
      gestureDownRef.current = false;
      endAt(cursor.x, cursor.y);
    }
  }, [tool, startAt, moveAt, endAt]);

  useImperativeHandle(ref, () => ({
    exportPNG: async (background = "#0d0f1a") => {
      const out = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      out.width = dims.w * dpr; out.height = dims.h * dpr;
      const ctx = out.getContext("2d"); if (!ctx) return null;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = background; ctx.fillRect(0, 0, dims.w, dims.h);
      for (const o of objectsRef.current) drawObject(ctx, o);
      return await new Promise<Blob | null>((res) => out.toBlob((b) => res(b), "image/png"));
    },
    exportData: () => ({ version: 1, objects: objectsRef.current, width: dims.w, height: dims.h, exportedAt: new Date().toISOString() }),
    loadData: (d) => { pushUndo(); objectsRef.current = d.objects ?? []; commit(); },
    clear: () => { pushUndo(); objectsRef.current = []; commit(); },
    undo: () => { const prev = undoStackRef.current.pop(); if (prev) { objectsRef.current = prev; commit(); } },
    applyGestureCursor,
  }), [dims.w, dims.h, applyGestureCursor]);

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-card/30 rounded-lg overflow-hidden touch-none select-none">
      <canvas ref={baseRef} className="absolute inset-0" />
      <canvas
        ref={liveRef}
        className="absolute inset-0"
        style={{ cursor: tool === "pen" ? "crosshair" : tool === "eraser" ? "cell" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
});

// --- helpers ---

function drawObject(ctx: CanvasRenderingContext2D, o: BoardObject) {
  if (o.type === "stroke") drawStrokePath(ctx, o.points, o.color, o.size);
  else if (o.type === "rect" || o.type === "circle" || o.type === "arrow") drawShape(ctx, o.type, o.x, o.y, o.w, o.h, o.color, o.size);
  else if (o.type === "text") {
    ctx.fillStyle = o.color;
    ctx.font = `${o.size}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(o.text, o.x, o.y);
  }
}

function drawStrokePath(ctx: CanvasRenderingContext2D, points: Point[], color: string, size: number) {
  if (points.length < 2) return;
  const stroke = getStroke(points.map((p) => [p.x, p.y, p.p ?? 0.5]), {
    size: size * 2.2, thinning: 0.5, smoothing: 0.6, streamline: 0.5,
  });
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < stroke.length; i++) {
    const [x, y] = stroke[i];
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, type: "rect" | "circle" | "arrow", x: number, y: number, w: number, h: number, color: string, size: number) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (type === "rect") ctx.strokeRect(x, y, w, h);
  else if (type === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "arrow") {
    const x2 = x + w, y2 = y + h;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    const ang = Math.atan2(h, w); const head = Math.max(10, size * 3);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
    ctx.stroke();
  }
}

function hitTest(o: BoardObject, x: number, y: number, r: number): boolean {
  if (o.type === "stroke") {
    return o.points.some((p) => Math.hypot(p.x - x, p.y - y) < r);
  }
  if (o.type === "text") {
    return x >= o.x - r && x <= o.x + 200 + r && y >= o.y - r && y <= o.y + o.size + r;
  }
  const minX = Math.min(o.x, o.x + o.w), maxX = Math.max(o.x, o.x + o.w);
  const minY = Math.min(o.y, o.y + o.h), maxY = Math.max(o.y, o.y + o.h);
  return x >= minX - r && x <= maxX + r && y >= minY - r && y <= maxY + r;
}

async function rasterizeStrokeToPNG(points: Point[], color: string, size: number): Promise<string | null> {
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  const pad = 16; const w = Math.ceil(maxX - minX + pad * 2); const h = Math.ceil(maxY - minY + pad * 2);
  if (w < 8 || h < 8) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d"); if (!ctx) return null;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  const shifted = points.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad, p: p.p }));
  drawStrokePath(ctx, shifted, "#000000", Math.max(2, size));
  return c.toDataURL("image/png");
}
