/**
 * Hand-landmark math.
 *
 * MediaPipe returns 21 landmarks per hand, indexed:
 *   0 = wrist
 *   1-4   = thumb (CMC, MCP, IP, TIP)
 *   5-8   = index  (MCP, PIP, DIP, TIP)
 *   9-12  = middle
 *   13-16 = ring
 *   17-20 = pinky
 *
 * Each landmark has normalized x,y in [0,1] (image space, origin top-left)
 * plus z (depth, smaller = closer to camera).
 *
 * We treat a finger as "extended" when its TIP is further from the wrist
 * than its PIP joint along the wrist→MCP axis. For the thumb we compare
 * along the perpendicular axis because it bends sideways.
 */

export interface LM { x: number; y: number; z: number }

export interface FingerStates {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
}

const dist2 = (a: LM, b: LM) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

/** Distance squared from wrist used as "is this finger extended?" heuristic. */
function isExtended(wrist: LM, mcp: LM, pip: LM, tip: LM): boolean {
  // tip should be farther from wrist than pip when finger is straight
  return dist2(wrist, tip) > dist2(wrist, pip) * 1.15;
}

export function fingerStates(lm: LM[]): FingerStates {
  const wrist = lm[0];
  return {
    // Thumb: compare tip vs IP joint horizontally (handles lateral motion)
    thumb: dist2(wrist, lm[4]) > dist2(wrist, lm[3]) * 1.05,
    index: isExtended(wrist, lm[5], lm[6], lm[8]),
    middle: isExtended(wrist, lm[9], lm[10], lm[12]),
    ring: isExtended(wrist, lm[13], lm[14], lm[16]),
    pinky: isExtended(wrist, lm[17], lm[18], lm[20]),
  };
}

/** Euclidean distance between thumb tip and index tip — for pinch detection. */
export function pinchDistance(lm: LM[]): number {
  return Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
}

/** Convert normalized landmark to canvas pixel coords with optional mirror. */
export function toCanvas(lm: LM, w: number, h: number, mirror = true): { x: number; y: number } {
  return { x: (mirror ? 1 - lm.x : lm.x) * w, y: lm.y * h };
}
