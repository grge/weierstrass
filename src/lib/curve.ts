import type { Vec2 } from "./types";
import { inv2 } from "./math";

/**
 * A single connected real component of y² = 4x³ − g₂x − g₃.
 * xs[i], yPos[i], yNeg[i] are guaranteed finite — no NaN sentinel values.
 * yPos[i] ≥ 0, yNeg[i] ≤ 0, yPos[i] = -yNeg[i] always holds.
 */
export type Branch = {
  xs: Float32Array;
  yPos: Float32Array;
  yNeg: Float32Array;
  bounded: boolean;  // true = oval [e1,e2]; false = tail [e3,∞)
};

/**
 * Compute Weierstrass invariants g₂ and g₃ from lattice basis.
 *
 * g₂(ω₁, ω₂) = 60 · Σ'_{m,n} (mω₁ + nω₂)^{-4}
 * g₃(ω₁, ω₂) = 140 · Σ'_{m,n} (mω₁ + nω₂)^{-6}
 *
 * where Σ' excludes (m,n) = (0,0).
 */
export function computeG2G3(
  omega1: Vec2,
  omega2: Vec2,
  terms = 5,
): { g2: number; g3: number } {
  let s4x = 0;
  let s6x = 0;

  for (let m = -terms; m <= terms; m++) {
    for (let n = -terms; n <= terms; n++) {
      if (m === 0 && n === 0) continue;

      const wx = m * omega1.x + n * omega2.x;
      const wy = m * omega1.y + n * omega2.y;

      const [r2x, r2y] = inv2(wx, wy);

      // (w)^{-4} = ((w)^{-2})^2
      const r4x = r2x * r2x - r2y * r2y;
      const r4y = 2 * r2x * r2y;
      s4x += r4x;

      // (w)^{-6} = (w^{-4}) * (w^{-2})
      const r6x = r4x * r2x - r4y * r2y;
      s6x += r6x;
    }
  }

  return { g2: 60 * s4x, g3: 140 * s6x };
}

/**
 * Find the real roots of the cubic 4x³ - g₂x - g₃ = 0.
 * Equivalently: x³ - (g₂/4)x - g₃/4 = 0  (depressed cubic t³ + pt + q = 0).
 * Returns a sorted array of 1 or 3 real roots.
 */
export function cubicRoots(g2: number, g3: number): number[] {
  const p = -g2 / 4;
  const q = -g3 / 4;

  // Radicand of Cardano's formula: when negative → 3 real roots (casus irreducibilis)
  const radicand = q * q / 4 + p * p * p / 27;

  // Epsilon guard for discriminant near zero (repeated root, degenerate case)
  const EPS_DISC = 1e-10;
  if (Math.abs(radicand) < EPS_DISC) {
    // Repeated root — trig method is numerically unstable near zero discriminant
    return [Math.cbrt(-q / 2) * 2];
  }

  if (radicand > 0) {
    // One real root
    const s = Math.sqrt(radicand);
    return [Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s)];
  }

  if (p >= 0) {
    return [Math.cbrt(-q)];
  }

  // Three real roots — trigonometric method
  const m = 2 * Math.sqrt(-p / 3);
  const arg = Math.max(-1, Math.min(1, (3 * q) / (p * m)));
  const theta = Math.acos(arg) / 3;

  return [
    m * Math.cos(theta),
    m * Math.cos(theta - (2 * Math.PI) / 3),
    m * Math.cos(theta - (4 * Math.PI) / 3),
  ].sort((a, b) => a - b);
}

/**
 * Returns the connected real intervals where 4x³ − g₂x − g₃ ≥ 0.
 * Each interval is [lo, hi|null] where null means unbounded above.
 *
 * - 1 real root e: returns [[e, null]] (unbounded tail on [e, ∞))
 * - 3 real roots e1 < e2 < e3: returns [[e1, e2], [e3, null]] (oval + unbounded tail)
 */
export function realIntervals(
  g2: number,
  g3: number,
): Array<[number, number | null]> {
  const roots = cubicRoots(g2, g3);

  if (roots.length === 1) {
    return [[roots[0], null]];
  }

  // roots.length === 3, sorted ascending: e1 ≤ e2 ≤ e3
  const [e1, e2, e3] = roots as [number, number, number];
  return [
    [e1, e2],   // bounded oval
    [e3, null], // unbounded tail
  ];
}

/**
 * Sample one real interval of y² = 4x³ − g₂x − g₃ using root-aware parametrization.
 *
 * Bounded interval [a, b]:
 *   x(θ) = a + (b−a)·sin²(θ),  θ ∈ [0, π/2]
 *   Dense near both endpoints where the curve meets the x-axis.
 *
 * Unbounded interval [a, ∞):
 *   x(u) = a + L·u²/(1−u²),  u ∈ [0, uMax)
 *   where L = (viewXMax−a)·(1−uMax²)/uMax², uMax = 0.97
 *   Dense near a, sparse at large x.
 *
 * @param lo       Left root endpoint (exact)
 * @param hi       Right root endpoint, or null for unbounded
 * @param viewXMax The right edge of the current viewport — used to compute L for unbounded
 * @param steps    Number of sample points (default 200)
 */
export function sampleInterval(
  g2: number,
  g3: number,
  lo: number,
  hi: number | null,
  viewXMax: number,
  steps = 200,
): Branch {
  const xs = new Float32Array(steps);
  const yPos = new Float32Array(steps);
  const yNeg = new Float32Array(steps);

  if (hi !== null) {
    // Bounded: x = lo + (hi−lo)·sin²(θ), θ from 0 to π/2
    for (let i = 0; i < steps; i++) {
      const theta = (Math.PI / 2) * (i / (steps - 1));
      const s = Math.sin(theta);
      const x = lo + (hi - lo) * s * s;
      xs[i] = x;
      const rhs = Math.max(0, 4 * x * x * x - g2 * x - g3);
      const y = Math.sqrt(rhs);
      yPos[i] = y;
      yNeg[i] = -y;
    }
    return { xs, yPos, yNeg, bounded: true };
  } else {
    // Unbounded: x = lo + L·u²/(1−u²), u from 0 to uMax
    const uMax = 0.97;
    const reach = Math.max(viewXMax - lo, 1);
    const L = (reach * (1 - uMax * uMax)) / (uMax * uMax);

    for (let i = 0; i < steps; i++) {
      const u = uMax * (i / (steps - 1));
      const x = lo + (L * u * u) / (1 - u * u);
      xs[i] = x;
      const rhs = Math.max(0, 4 * x * x * x - g2 * x - g3);
      const y = Math.sqrt(rhs);
      yPos[i] = y;
      yNeg[i] = -y;
    }
    return { xs, yPos, yNeg, bounded: false };
  }
}

/**
 * Compute axis bounds that show the full character of the curve.
 *
 * The curve y² = 4x³ - g₂x - g₃ has:
 * - Roots of the RHS (where the curve meets the x-axis)
 * - Critical points of the RHS at x = ±√(g₂/12) when g₂ > 0
 *   (these are the "bumps" — local max/min of the cubic)
 *
 * We build the viewport to cover both the roots and the critical points,
 * with regime-specific framing (1 root vs 3 roots), and consolidate all
 * padding logic in one place.
 */
export function computeAxisBounds(
  g2: number,
  g3: number,
): { xMin: number; xMax: number; yMax: number } {
  const roots = cubicRoots(g2, g3);

  // Critical points of f(x) = 4x³ − g₂x − g₃: f′(x) = 12x² − g₂ = 0
  const critX = g2 > 0 ? Math.sqrt(g2 / 12) : null;

  // Compute yMax analytically from critical-point magnitudes
  let yMax = 1;
  if (critX !== null) {
    const eval_f = (x: number) => 4 * x * x * x - g2 * x - g3;
    const fPos = eval_f(critX);
    const fNeg = eval_f(-critX);
    if (fPos > 0) yMax = Math.max(yMax, Math.sqrt(fPos));
    if (fNeg > 0) yMax = Math.max(yMax, Math.sqrt(fNeg));
  }

  let xMin: number;
  let xMax: number;

  if (roots.length === 1) {
    // One real root: frame tightly around root + nearby critical structure
    const e = roots[0];
    const landmarks = critX !== null ? [e, -critX, critX] : [e];
    const lo = Math.min(...landmarks);
    const hi = Math.max(...landmarks);
    const span = Math.max(hi - lo, 1);

    xMin = lo - span * 0.25;
    xMax = hi + span * 0.55;  // generous right pad to show tail start

    // Sample yMax a bit to the right of root to capture y-scale of visible tail
    const xProbe = e + span * 0.5;
    const rhsProbe = 4 * xProbe * xProbe * xProbe - g2 * xProbe - g3;
    if (rhsProbe > 0) yMax = Math.max(yMax, Math.sqrt(rhsProbe));
  } else {
    // Three real roots: show oval + critical points + start of unbounded tail
    const [e1, , e3] = roots as [number, number, number];
    const landmarks = critX !== null ? [e1, e3, -critX, critX] : [e1, e3];
    const lo = Math.min(...landmarks);
    const hi = Math.max(...landmarks);
    const span = Math.max(hi - lo, 1);

    xMin = lo - span * 0.25;
    xMax = hi + span * 0.40;  // include start of unbounded tail

    // Sample yMax at the unbounded branch start
    const xProbe = e3 + span * 0.3;
    const rhsProbe = 4 * xProbe * xProbe * xProbe - g2 * xProbe - g3;
    if (rhsProbe > 0) yMax = Math.max(yMax, Math.sqrt(rhsProbe));
  }

  // Presentation padding — single source of truth, consolidates all pad logic
  const xSpan = xMax - xMin;
  xMin -= xSpan * 0.08;
  xMax += xSpan * 0.08;
  yMax *= 1.20;

  return { xMin, xMax, yMax };
}
