/**
 * Centralized overlay styling constants for all views.
 *
 * Baseline: EllipticCurveView's grid styling, which uses cyan for gridlines
 * and labels (when grid is on) and white axes (when grid is off).
 *
 * All overlays across all views (ℂ plane, ℂ/Λ torus, τ plane, ℝ² curve)
 * use these constants to ensure visual consistency.
 */

export const OVERLAY_COLORS = {
  // Grid: cyan gridlines, labels, and axes (when grid is enabled)
  gridMajor: "rgba(180, 225, 255, 0.38)",   // main gridlines
  gridMinor: "rgba(180, 225, 255, 0.14)",   // dimmer gridlines (for future sub-gridlines)
  gridLabel: "rgba(180, 225, 255, 0.78)",   // tick labels and grid-on axes
  gridAxis: "rgba(180, 225, 255, 0.62)",    // axis lines when grid is on
  gridAxisNoGrid: "rgba(255, 255, 255, 0.2)", // axis lines when grid is off (reference only)

  // Lattice and cell boundaries: orange
  lattice: "rgba(255, 155, 50, 0.35)",      // lattice tiling (ℂ plane)
  cell: "rgba(255, 155, 50, 0.45)",         // fundamental cell/domain boundary

  // Markers: poles, zeros, roots; bright orange
  marker: "rgba(255, 155, 50, 0.95)",       // poles, zeros, roots (bright)
  markerSize: 5,                             // marker radius in pixels

  // Omega vectors: ω₁/ω₂ handles
  omega: "rgba(255, 155, 50, 0.7)",         // omega vector colour
  omegaArrowSize: 8,                         // arrowhead size
};

export const OVERLAY_WEIGHTS = {
  thin: 0.5,    // grid lines
  normal: 1.0,  // cell boundaries, axes
  thick: 1.5,   // markers, omega vectors
};

/**
 * Helper to format grid tick labels.
 * Selects decimal places based on the grid step size.
 */
export function formatGridLabel(value: number, step: number): string {
  if (step < 0.1) {
    return value.toFixed(2);
  } else if (step < 1) {
    return value.toFixed(1);
  } else {
    return value.toFixed(0);
  }
}
