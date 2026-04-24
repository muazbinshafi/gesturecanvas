/**
 * Pose classifier with simple hysteresis to prevent flicker.
 * Maps finger-extension state + pinch distance to a high-level Pose enum.
 */
import type { Pose } from "../types";
import { fingerStates, pinchDistance, type LM } from "./landmarks";

const PINCH_THRESHOLD = 0.06; // normalized distance — small = pinching

export function classifyPose(lm: LM[]): Pose {
  const f = fingerStates(lm);
  const pinch = pinchDistance(lm);

  // Pinch wins when thumb+index are very close
  if (pinch < PINCH_THRESHOLD && !f.middle && !f.ring && !f.pinky) return "PINCH";

  // Open hand = all fingers extended → erase
  if (f.index && f.middle && f.ring && f.pinky) return "ERASE";

  // Index + middle up → hover/cursor
  if (f.index && f.middle && !f.ring && !f.pinky) return "HOVER";

  // Index only → draw
  if (f.index && !f.middle && !f.ring && !f.pinky) return "DRAW";

  // No fingers extended (closed fist) → pan
  if (!f.index && !f.middle && !f.ring && !f.pinky) return "PAN";

  return "NONE";
}

/** Smooths pose transitions: requires N consecutive frames to switch. */
export class PoseStabilizer {
  private current: Pose = "NONE";
  private candidate: Pose = "NONE";
  private count = 0;
  constructor(private threshold = 3) {}
  push(next: Pose): Pose {
    if (next === this.current) { this.candidate = next; this.count = 0; return this.current; }
    if (next === this.candidate) { this.count++; }
    else { this.candidate = next; this.count = 1; }
    if (this.count >= this.threshold) { this.current = next; this.count = 0; }
    return this.current;
  }
}
