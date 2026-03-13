import type { Vec2 } from "./types";
import { fromLatticeCoords, reduceToFundamental } from "./lattice";

// ── low-level helpers ──────────────────────────────────────────────────────

/** (a+bi)^{-2} as [re, im] */
function inv2(ax: number, ay: number): [number, number] {
  const d2 = (ax*ax + ay*ay) ** 2 || 1e-30;
  return [(ax*ax - ay*ay) / d2, -2*ax*ay / d2];
}

/** (a+bi)^{-3} as [re, im] */
function inv3(ax: number, ay: number): [number, number] {
  const d3 = (ax*ax + ay*ay) ** 3 || 1e-30;
  return [(ax*ax*ax - 3*ax*ay*ay) / d3, (-3*ax*ax*ay + ay*ay*ay) / d3];
}

// ── Weierstrass ℘ in JavaScript (for zero-finding) ────────────────────────

export function wpEval(z: Vec2, omega1: Vec2, omega2: Vec2, terms = 5): Vec2 {
  let [sx, sy] = inv2(z.x, z.y);
  for (let m = -terms; m <= terms; m++) {
    for (let n = -terms; n <= terms; n++) {
      if (m === 0 && n === 0) continue;
      const wx = m * omega1.x + n * omega2.x;
      const wy = m * omega1.y + n * omega2.y;
      const [t1x, t1y] = inv2(z.x - wx, z.y - wy);
      const [t2x, t2y] = inv2(wx, wy);
      sx += t1x - t2x;
      sy += t1y - t2y;
    }
  }
  return { x: sx, y: sy };
}

export function wpPrimeEval(z: Vec2, omega1: Vec2, omega2: Vec2, terms = 5): Vec2 {
  let sx = 0, sy = 0;
  for (let m = -terms; m <= terms; m++) {
    for (let n = -terms; n <= terms; n++) {
      const wx = m * omega1.x + n * omega2.x;
      const wy = m * omega1.y + n * omega2.y;
      const [tx, ty] = inv3(z.x - wx, z.y - wy);
      sx -= 2 * tx;
      sy -= 2 * ty;
    }
  }
  return { x: sx, y: sy };
}

/** Fold a world point back into the fundamental domain [0,1)×[0,1) in lattice coords. */
export function toFundamental(z: Vec2, omega1: Vec2, omega2: Vec2): Vec2 {
  return reduceToFundamental(z, omega1, omega2);
}

/**
 * Find the two zeros of ℘(z) in the fundamental domain via Newton's method.
 * Pass warmStart (previous zeros) to skip the expensive grid search — useful
 * when the lattice changes only slightly (e.g. interactive dragging).
 */
export function findWeierstrassZeros(
  omega1: Vec2,
  omega2: Vec2,
  warmStart: Vec2[] = [],
  terms = 5,
): Vec2[] {
  const runNewton = (z0: Vec2): Vec2 | null => {
    let z = { ...z0 };
    for (let iter = 0; iter < 30; iter++) {
      const f = wpEval(z, omega1, omega2, terms);
      if (Math.hypot(f.x, f.y) < 1e-13) return z;
      const df = wpPrimeEval(z, omega1, omega2, terms);
      const dfMag = Math.hypot(df.x, df.y);
      if (!Number.isFinite(dfMag) || dfMag < 1e-10) return null;
      const step = complexDiv(f, df);
      z = { x: z.x - step.x, y: z.y - step.y };
      if (!Number.isFinite(z.x) || !Number.isFinite(z.y)) return null;
    }
    const f = wpEval(z, omega1, omega2, terms);
    return Math.hypot(f.x, f.y) < 1e-8 ? z : null;
  };

  const pickSeed = (): Vec2 | null => {
    const N = 14;
    let bestZ: Vec2 | null = null;
    let minMag = Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const u = (i + 0.5) / N;
        const v = (j + 0.5) / N;
        if (u < 0.1 && v < 0.1) continue;
        const z = fromLatticeCoords(u, v, omega1, omega2);
        const w = wpEval(z, omega1, omega2, terms);
        const mag = Math.hypot(w.x, w.y);
        if (mag < minMag) {
          minMag = mag;
          bestZ = z;
        }
      }
    }
    return bestZ;
  };

  const seed = warmStart.length > 0 ? warmStart[0] : pickSeed();
  if (!seed) return warmStart;

  const z1 = runNewton(seed) ?? (warmStart.length > 0 ? runNewton(warmStart[0]) : null);
  if (!z1) return warmStart;

  const z1f = toFundamental(z1, omega1, omega2);
  const z2 = toFundamental({ x: -z1.x, y: -z1.y }, omega1, omega2);
  return [z1f, z2];
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function complexDiv(a: Vec2, b: Vec2): Vec2 {
  const d = b.x * b.x + b.y * b.y || 1e-8;
  return {
    x: (a.x * b.x + a.y * b.y) / d,
    y: (a.y * b.x - a.x * b.y) / d,
  };
}

export function worldToScreen(
  x: number, y: number,
  width: number, height: number,
  panX: number, panY: number,
  zoom: number
): Vec2 {
  const s = Math.min(width, height);
  return {
    x: width / 2 + ((x - panX) * zoom * s) / 2,
    y: height / 2 - ((y - panY) * zoom * s) / 2,
  };
}

export function screenToWorld(
  px: number, py: number,
  width: number, height: number,
  panX: number, panY: number,
  zoom: number
): Vec2 {
  const s = Math.min(width, height);
  return {
    x: panX + ((px - width / 2) * 2) / (zoom * s),
    y: panY - ((py - height / 2) * 2) / (zoom * s),
  };
}
