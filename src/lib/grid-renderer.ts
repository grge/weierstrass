/**
 * Smart grid rendering utility used by all views.
 *
 * Handles:
 * - Automatic step selection (granularity) from {0.1, 0.2, 0.5, 1, 2, 5, 10, ...}
 * - Gridlines with smart spacing
 * - Tick marks perpendicular to the axis
 * - Formatted labels with appropriate decimal places
 *
 * This module is used by EllipticCurveView, EllipticFunctionView, and ModularFormView
 * to ensure consistent grid rendering across all visualization spaces.
 */

import { OVERLAY_COLORS, OVERLAY_WEIGHTS, formatGridLabel } from "./overlay-styles";

/**
 * Pick a grid step size from the set {0.1, 0.2, 0.5, 1, 2, 5, 10, …}
 * such that there are at most ~maxLines lines in the given span.
 *
 * @param span The span of the axis (e.g., xMax - xMin)
 * @param maxLines Target maximum number of lines (default 8)
 * @returns The selected step size
 */
export function pickGridStep(span: number, maxLines = 8): number {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let bestStep = 0.1;

  for (const step of steps) {
    const numLines = Math.ceil(span / step);
    if (numLines <= maxLines) {
      bestStep = step;
      break;
    }
  }

  return bestStep;
}

/**
 * Generate tick positions for a given axis range and step size.
 * @param min Minimum value on the axis
 * @param max Maximum value on the axis
 * @param step Step size between ticks
 * @returns Array of tick positions (excluding origin if present)
 */
export function generateTicks(min: number, max: number, step: number): number[] {
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max; value += step) {
    // Skip origin (value ≈ 0)
    if (Math.abs(value) < 1e-10) continue;
    ticks.push(value);
  }
  return ticks;
}

export interface GridRenderOptions {
  showGrid: boolean;
  showTicks?: boolean;
  showLabels?: boolean;
  tickSize?: number;        // size of tick marks in pixels
  labelOffset?: number;     // offset from tick to label in pixels
  labelFont?: string;       // CSS font spec
  edgeClip?: number;        // skip labels within N pixels of canvas edges
}

/**
 * Render a 1D grid (axis) with smart granularity, ticks, and labels.
 *
 * This is a generic utility that works for any axis orientation by accepting
 * a conversion function from world coordinates to canvas coordinates.
 *
 * @param ctx Canvas 2D context
 * @param bounds Visible range in world coordinates {min, max}
 * @param toCanvasPos Function to convert a world coordinate to canvas position
 * @param perpStart Canvas position for perpendicular axis start (e.g., 0 for top)
 * @param perpEnd Canvas position for perpendicular axis end (e.g., height for bottom)
 * @param axisPos Canvas position of the actual axis (for label positioning)
 * @param axisAtStart If true, axis is clamped to perpStart (off-screen start side); labels flip
 * @param isVertical If true, ticks extend vertically; if false, horizontally
 * @param options Rendering options
 */
export function drawGridWithTicks(
  ctx: CanvasRenderingContext2D,
  bounds: { min: number; max: number },
  toCanvasPos: (worldValue: number) => number,
  perpStart: number,
  perpEnd: number,
  axisPos: number,
  axisAtStart: boolean,
  isVertical: boolean,
  options: GridRenderOptions,
): void {
  if (!options.showGrid) return;

  const tickSize = options.tickSize ?? 4;
  const labelOffset = options.labelOffset ?? 4;
  const labelFont = options.labelFont ?? "9px monospace";
  const edgeClip = options.edgeClip ?? 6;

  const step = pickGridStep(bounds.max - bounds.min);
  const ticks = generateTicks(bounds.min, bounds.max, step);

  // Draw gridlines
  ctx.strokeStyle = OVERLAY_COLORS.gridMajor;
  ctx.lineWidth = OVERLAY_WEIGHTS.thin;

  for (const tick of ticks) {
    const pos = toCanvasPos(tick);

    if (isVertical) {
      // Vertical gridline
      ctx.beginPath();
      ctx.moveTo(pos, perpStart);
      ctx.lineTo(pos, perpEnd);
      ctx.stroke();
    } else {
      // Horizontal gridline
      ctx.beginPath();
      ctx.moveTo(perpStart, pos);
      ctx.lineTo(perpEnd, pos);
      ctx.stroke();
    }
  }

  // Draw ticks and labels
  if (options.showTicks !== false) {
    ctx.strokeStyle = OVERLAY_COLORS.gridLabel;
    ctx.lineWidth = OVERLAY_WEIGHTS.thin;

    for (const tick of ticks) {
      const pos = toCanvasPos(tick);

      if (isVertical) {
        // Vertical axis: ticks extend left-right from axis
        ctx.beginPath();
        ctx.moveTo(pos - tickSize, axisPos);
        ctx.lineTo(pos + tickSize, axisPos);
        ctx.stroke();
      } else {
        // Horizontal axis: ticks extend up-down from axis
        ctx.beginPath();
        ctx.moveTo(axisPos, pos - tickSize);
        ctx.lineTo(axisPos, pos + tickSize);
        ctx.stroke();
      }
    }
  }

  // Draw labels
  if (options.showLabels !== false) {
    ctx.fillStyle = OVERLAY_COLORS.gridLabel;
    ctx.font = labelFont;

    for (const tick of ticks) {
      const pos = toCanvasPos(tick);
      const label = formatGridLabel(tick, step);

      if (isVertical) {
        // Labels for vertical gridlines (x-axis values)
        // axisAtStart=true means x-axis is above canvas → labels at top, pointing down
        // axisAtStart=false (default) means axis visible or below → labels below axis
        const textW = ctx.measureText(label).width;
        const labelX = pos - textW / 2;

        // Skip if label would overflow left/right edges
        if (labelX < edgeClip || labelX + textW > ctx.canvas.width - edgeClip) continue;

        if (axisAtStart) {
          // Axis above canvas: draw labels just below top edge
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(label, labelX, axisPos + labelOffset);
        } else if (axisPos >= perpEnd) {
          // Axis below canvas: draw labels just above bottom edge
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(label, labelX, axisPos - labelOffset);
        } else {
          // Axis visible: draw labels below axis line
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          const labelY = axisPos + labelOffset;
          if (labelY + 10 <= perpEnd) {
            ctx.fillText(label, labelX, labelY);
          } else {
            // No room below, flip above
            ctx.textBaseline = "bottom";
            ctx.fillText(label, labelX, axisPos - labelOffset);
          }
        }
      } else {
        // Labels for horizontal gridlines (y-axis values)
        // axisAtStart=true means y-axis is left of canvas → labels at left edge, pointing right
        // axisAtStart=false (default) means axis visible or right → labels left of axis
        const textW = ctx.measureText(label).width;
        const labelY = pos - 2;

        // Skip if label would overflow top/bottom edges
        if (labelY < edgeClip || labelY > ctx.canvas.height - edgeClip) continue;

        if (axisAtStart) {
          // Axis left of canvas: draw labels just inside left edge
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(label, axisPos + labelOffset, labelY);
        } else if (axisPos >= perpEnd) {
          // Axis right of canvas: draw labels just inside right edge
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(label, axisPos - labelOffset, labelY);
        } else {
          // Axis visible: draw labels to the left of axis
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          const labelX = axisPos - labelOffset;
          if (labelX - textW >= edgeClip) {
            ctx.fillText(label, labelX, labelY);
          } else {
            // No room on left, flip to right
            ctx.textAlign = "left";
            ctx.fillText(label, axisPos + labelOffset, labelY);
          }
        }
      }
    }
  }
}

/**
 * Simplified 2D grid rendering for rectangular grids.
 *
 * Renders both horizontal and vertical gridlines with shared options.
 * This is useful for ℂ plane and τ plane views where you want integer grids
 * in both directions.
 *
 * @param ctx Canvas 2D context
 * @param xBounds Visible x-axis range {min, max}
 * @param yBounds Visible y-axis range {min, max}
 * @param toCanvasX Function to convert world x to canvas x
 * @param toCanvasY Function to convert world y to canvas y
 * @param canvasWidth Canvas width in pixels
 * @param canvasHeight Canvas height in pixels
 * @param options Rendering options
 */
export function drawGridWithTicksXY(
  ctx: CanvasRenderingContext2D,
  xBounds: { min: number; max: number },
  yBounds: { min: number; max: number },
  toCanvasX: (x: number) => number,
  toCanvasY: (y: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  options: GridRenderOptions,
): void {
  if (!options.showGrid) return;

  // Find the axis positions in canvas coords
  // (where y=0 for x-axis, where x=0 for y-axis)
  const xAxisCanvasY = toCanvasY(0);
  const yAxisCanvasX = toCanvasX(0);

  // Use actual axis position if visible, otherwise use canvas edge
  // X-axis: if y=0 is above canvas, use top; if below, use bottom
  let xAxisPos: number;
  if (xAxisCanvasY < 0) {
    xAxisPos = 0; // axis is above canvas, draw labels at top
  } else if (xAxisCanvasY > canvasHeight) {
    xAxisPos = canvasHeight; // axis is below canvas, draw labels at bottom
  } else {
    xAxisPos = xAxisCanvasY; // axis is visible
  }

  // Y-axis: if x=0 is left of canvas, use left; if right, use right
  let yAxisPos: number;
  if (yAxisCanvasX < 0) {
    yAxisPos = 0; // axis is left of canvas, draw labels at left
  } else if (yAxisCanvasX > canvasWidth) {
    yAxisPos = canvasWidth; // axis is right of canvas, draw labels at right
  } else {
    yAxisPos = yAxisCanvasX; // axis is visible
  }

  // X-axis (vertical gridlines from top to bottom)
  drawGridWithTicks(
    ctx,
    xBounds,
    toCanvasX,
    0,                    // top of canvas
    canvasHeight,         // bottom of canvas
    xAxisPos,             // where x-axis actually is in canvas coords
    xAxisCanvasY < 0,     // true if axis is above canvas (clamped to top)
    true,                 // isVertical
    options,
  );

  // Y-axis (horizontal gridlines from left to right)
  drawGridWithTicks(
    ctx,
    yBounds,
    toCanvasY,
    0,                    // left of canvas
    canvasWidth,          // right of canvas
    yAxisPos,             // where y-axis actually is in canvas coords
    yAxisCanvasX < 0,     // true if axis is left of canvas (clamped to left)
    false,                // isVertical
    options,
  );
}
