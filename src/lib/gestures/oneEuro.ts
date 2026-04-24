/**
 * One-Euro filter — classic low-latency smoothing for jittery inputs.
 * https://gery.casiez.net/1euro/
 *
 * minCutoff (Hz): smoothing strength when the signal is slow.
 * beta:           how aggressively cutoff increases with speed.
 *                 Higher beta = more responsive on fast motions.
 */
export class OneEuroFilter {
  private xPrev = 0; private dxPrev = 0; private tPrev = 0; private hasPrev = false;
  constructor(public minCutoff = 1.0, public beta = 0.007, public dCutoff = 1.0) {}

  reset() { this.hasPrev = false; }

  filter(value: number, tMs: number): number {
    if (!this.hasPrev) { this.xPrev = value; this.tPrev = tMs; this.hasPrev = true; return value; }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-6);
    const dx = (value - this.xPrev) / dt;
    const aD = this.alpha(dt, this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(dt, cutoff);
    const xHat = a * value + (1 - a) * this.xPrev;
    this.xPrev = xHat; this.dxPrev = dxHat; this.tPrev = tMs;
    return xHat;
  }

  private alpha(dt: number, cutoff: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
}

export class Vec2Filter {
  fx: OneEuroFilter; fy: OneEuroFilter;
  constructor(minCutoff = 1.0, beta = 0.007) {
    this.fx = new OneEuroFilter(minCutoff, beta);
    this.fy = new OneEuroFilter(minCutoff, beta);
  }
  set(minCutoff: number, beta: number) {
    this.fx.minCutoff = minCutoff; this.fx.beta = beta;
    this.fy.minCutoff = minCutoff; this.fy.beta = beta;
  }
  reset() { this.fx.reset(); this.fy.reset(); }
  filter(x: number, y: number, t: number) {
    return { x: this.fx.filter(x, t), y: this.fy.filter(y, t) };
  }
}
