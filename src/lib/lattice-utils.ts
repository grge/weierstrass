import type { Vec2 } from "./types";

/**
 * Get the scale (magnitude) of a lattice vector
 */
export function getScale(omega: Vec2): number {
  return Math.sqrt(omega.x * omega.x + omega.y * omega.y);
}

/**
 * Apply a scaling factor to both lattice vectors
 */
export function scaleLattice(omega1: Vec2, omega2: Vec2, factor: number): { omega1: Vec2; omega2: Vec2 } {
  return {
    omega1: { x: omega1.x * factor, y: omega1.y * factor },
    omega2: { x: omega2.x * factor, y: omega2.y * factor },
  };
}

/**
 * Normalize the first lattice vector to unit scale
 */
export function normalizeLattice(omega1: Vec2, omega2: Vec2): { omega1: Vec2; omega2: Vec2 } {
  const scale = getScale(omega1);
  if (scale < 1e-12) return { omega1, omega2 }; // avoid division by zero
  const factor = 1 / scale;
  return scaleLattice(omega1, omega2, factor);
}