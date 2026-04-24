// Shared types for the whiteboard app.

export type Tool = "pen" | "eraser" | "rect" | "circle" | "arrow" | "text" | "select" | "pan";

export type Pose = "DRAW" | "HOVER" | "PAN" | "ERASE" | "PINCH" | "NONE";

export interface Point { x: number; y: number; p?: number }

export interface BaseObject {
  id: string;
  type: string;
  color: string;
  createdAt: number;
}

export interface StrokeObject extends BaseObject {
  type: "stroke";
  points: Point[];
  size: number;
}

export interface ShapeObject extends BaseObject {
  type: "rect" | "circle" | "arrow";
  x: number; y: number; w: number; h: number;
  size: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  x: number; y: number;
  text: string;
  size: number;
}

export type BoardObject = StrokeObject | ShapeObject | TextObject;

export interface BoardData {
  version: 1;
  objects: BoardObject[];
  width: number;
  height: number;
  exportedAt?: string;
}

export interface BrushSettings {
  size: number;
  color: string;
  smoothing: number;
}

export interface SmoothingSettings {
  /** One-Euro filter min cutoff (Hz). Lower = more smoothing. */
  minCutoff: number;
  /** One-Euro filter beta. Higher = more responsive to fast moves. */
  beta: number;
}

export interface GestureMappings {
  DRAW: Tool;
  HOVER: Tool;
  PAN: Tool;
  ERASE: Tool;
  PINCH: Tool;
}

export const DEFAULT_BRUSH: BrushSettings = { size: 4, color: "#a78bfa", smoothing: 0.5 };
export const DEFAULT_SMOOTHING: SmoothingSettings = { minCutoff: 1.2, beta: 0.015 };
export const DEFAULT_MAPPINGS: GestureMappings = {
  DRAW: "pen",
  HOVER: "select",
  PAN: "pan",
  ERASE: "eraser",
  PINCH: "select",
};
