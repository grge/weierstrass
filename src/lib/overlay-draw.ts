/**
 * Shared canvas 2D overlay drawing primitives.
 *
 * These are small, focused helpers used by EllipticFunctionView and
 * ModularFormView to draw consistent overlay elements (handles, axes,
 * vector arrows) without duplicating the same canvas calls.
 *
 * All coordinates are in device pixels. The caller is responsible for
 * applying any DPR scaling before passing positions.
 */

import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "./overlay-styles";

/**
 * Draw a labelled draggable handle — the orange circle with a text label
 * used for ω₁, ω₂ (EllipticFunctionView) and τ (ModularFormView).
 *
 * @param ctx  Canvas 2D context
 * @param x    Centre x in device pixels
 * @param y    Centre y in device pixels
 * @param label  Text drawn inside the circle (e.g. "ω₁", "τ")
 * @param active Whether the handle is hovered or being dragged
 * @param dpr  Device pixel ratio (used for sizing)
 */
export function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  active: boolean,
  dpr: number,
): void {
  const r = (active ? 12 : 10.5) * dpr;

  if (active) {
    ctx.fillStyle = OVERLAY_COLORS.omegaGlow;
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle   = active ? "rgba(255, 175, 75, 1.0)" : "rgba(255, 140, 40, 1.0)";
  ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.98)" : "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth   = (active ? 2.4 : 1.5) * dpr;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.fillStyle    = "rgba(255, 255, 255, 0.95)";
  ctx.font         = `600 ${Math.round(11 * dpr)}px system-ui, sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

/**
 * Draw the real and imaginary axes (two lines through the origin).
 *
 * Clips each line to the canvas: the x-axis is drawn only when origin.y
 * is within [0, h], and the y-axis only when origin.x is within [0, w].
 *
 * @param ctx       Canvas 2D context
 * @param originX   Canvas x of origin (device pixels)
 * @param originY   Canvas y of origin (device pixels)
 * @param w         Canvas width in device pixels
 * @param h         Canvas height in device pixels
 * @param dpr       Device pixel ratio
 */
export function drawAxesXY(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  w: number,
  h: number,
  dpr: number,
): void {
  ctx.strokeStyle = OVERLAY_COLORS.gridAxis;
  ctx.lineWidth   = OVERLAY_WEIGHTS.normal * dpr;

  // Horizontal axis (y = 0 line) — always draw full width
  ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(w, originY); ctx.stroke();

  // Vertical axis (x = 0 line) — only if origin is within horizontal bounds
  if (originX >= 0 && originX <= w) {
    ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, h); ctx.stroke();
  }
}

/**
 * Draw a vector line from one point to another.
 *
 * Used for ω₁, ω₂, and τ vector arrows. Does not draw an origin dot —
 * call drawOriginDot separately if needed (e.g. once for a shared origin).
 *
 * @param ctx    Canvas 2D context
 * @param fromX  Start x in device pixels
 * @param fromY  Start y in device pixels
 * @param toX    End x in device pixels
 * @param toY    End y in device pixels
 * @param dpr    Device pixel ratio
 */
export function drawVectorArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  dpr: number,
): void {
  ctx.strokeStyle = OVERLAY_COLORS.omega;
  ctx.lineWidth   = OVERLAY_WEIGHTS.thick * dpr;
  ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
}

/**
 * Draw the small filled dot at a vector origin point.
 */
export function drawOriginDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dpr: number,
): void {
  ctx.fillStyle = OVERLAY_COLORS.omega;
  ctx.beginPath(); ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2); ctx.fill();
}
