import type { Vec2 } from "./types";

export const LATTICE_EPS = 1e-8;

export function det(omega1: Vec2, omega2: Vec2): number {
  return omega1.x * omega2.y - omega1.y * omega2.x;
}

export function isDegenerateBasis(omega1: Vec2, omega2: Vec2, eps = LATTICE_EPS): boolean {
  return Math.abs(det(omega1, omega2)) < eps;
}

export function fromLatticeCoords(u: number, v: number, omega1: Vec2, omega2: Vec2): Vec2 {
  return {
    x: u * omega1.x + v * omega2.x,
    y: u * omega1.y + v * omega2.y,
  };
}

export function toLatticeCoords(z: Vec2, omega1: Vec2, omega2: Vec2, eps = LATTICE_EPS): Vec2 {
  const d = det(omega1, omega2);
  const safeDet = Math.abs(d) < eps ? (d < 0 ? -eps : eps) : d;
  return {
    x: (z.x * omega2.y - z.y * omega2.x) / safeDet,
    y: (-z.x * omega1.y + z.y * omega1.x) / safeDet,
  };
}

export function reduceToFundamental(z: Vec2, omega1: Vec2, omega2: Vec2): Vec2 {
  const uv = toLatticeCoords(z, omega1, omega2);
  const uf = ((uv.x % 1) + 1) % 1;
  const vf = ((uv.y % 1) + 1) % 1;
  return fromLatticeCoords(uf, vf, omega1, omega2);
}

export function tauFromBasis(omega1: Vec2, omega2: Vec2): Vec2 {
  const d = omega1.x * omega1.x + omega1.y * omega1.y;
  const safe = d > 1e-12 ? d : 1e-12;
  return {
    x: (omega2.x * omega1.x + omega2.y * omega1.y) / safe,
    y: (omega2.y * omega1.x - omega2.x * omega1.y) / safe,
  };
}

export function getScale(omega: Vec2): number {
  return Math.sqrt(omega.x * omega.x + omega.y * omega.y);
}

export function scaleLattice(omega1: Vec2, omega2: Vec2, factor: number): { omega1: Vec2; omega2: Vec2 } {
  return {
    omega1: { x: omega1.x * factor, y: omega1.y * factor },
    omega2: { x: omega2.x * factor, y: omega2.y * factor },
  };
}

export function normalizeLattice(omega1: Vec2, omega2: Vec2): { omega1: Vec2; omega2: Vec2 } {
  const scale = getScale(omega1);
  if (scale < 1e-12) return { omega1, omega2 };
  return scaleLattice(omega1, omega2, 1 / scale);
}

/**
 * Ensure Im(τ) = Im(ω₂/ω₁) > 0 by negating ω₂ when det(ω₁,ω₂) < 0.
 * The lattice {mω₁ + nω₂} is unchanged because n runs over all integers.
 */
export function canonicalizeBasis(omega1: Vec2, omega2: Vec2): { omega1: Vec2; omega2: Vec2 } {
  if (det(omega1, omega2) < 0) {
    return { omega1, omega2: { x: -omega2.x, y: -omega2.y } };
  }
  return { omega1, omega2 };
}

export function basisFromTau(tau: Vec2, scale = 1, angle = 0): { omega1: Vec2; omega2: Vec2 } {
  const omega1 = {
    x: scale * Math.cos(angle),
    y: scale * Math.sin(angle),
  };
  const omega2 = {
    x: omega1.x * tau.x - omega1.y * tau.y,
    y: omega1.x * tau.y + omega1.y * tau.x,
  };
  return { omega1, omega2 };
}
