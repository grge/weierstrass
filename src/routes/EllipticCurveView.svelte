<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    computeAxisBounds,
    cubicRoots,
    realIntervals,
    sampleInterval,
    pickGridStep,
  } from "$lib/curve";
  import type { Branch } from "$lib/curve";

  let {
    g2 = 0,
    g3 = 0,
    showControls = true,
    fillViewport = false,
    showGrid = false,
  }: {
    g2: number;
    g3: number;
    showControls?: boolean;
    fillViewport?: boolean;
    showGrid?: boolean;
  } = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cssW = $state(320);
  let cssH = $state(240);

  // Camera state — smoothed in log-scale coordinates
  // cx  = centre x = (xMin + xMax) / 2
  // sx  = log of x-width = log(xMax - xMin)
  // sy  = log of y-height = log(2 * yMax)
  type CamState = { cx: number; sx: number; sy: number };

  let cam: CamState = { cx: 0, sx: Math.log(4), sy: Math.log(4) };
  let target: CamState = { cx: 0, sx: Math.log(4), sy: Math.log(4) };
  let camInitialized = false;
  let userCamera = $state(false);  // true = manual pan/zoom active, false = auto-zoom
  let rafId: number | null = null;
  let restartLoop: () => void = () => {};

  // Pan/zoom state
  let dragStart: { px: number; cx: number } | null = null;
  const ZOOM_SPEED = 0.1;

  // Helper: reconstruct viewport bounds from camera state
  function camToViewport(c: CamState): { xMin: number; xMax: number; yMax: number } {
    const hw = Math.exp(c.sx) / 2;
    const hh = Math.exp(c.sy) / 2;
    return {
      xMin: c.cx - hw,
      xMax: c.cx + hw,
      yMax: hh,
    };
  }

  // Helper: convert bounds to camera state
  function boundsToCam(b: { xMin: number; xMax: number; yMax: number }): CamState {
    return {
      cx: (b.xMin + b.xMax) / 2,
      sx: Math.log(b.xMax - b.xMin),
      sy: Math.log(2 * b.yMax),
    };
  }

  onMount(() => {
    // ResizeObserver for canvas sizing
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      untrack(() => {
        cssW = e.contentRect.width;
        cssH = e.contentRect.height;
      });
    });
    ro.observe(container);

    // requestAnimationFrame loop for smooth camera animation
    const LERP_T = 0.15;
    const CAM_EPS = 1e-4;
    let frameRef: FrameRequestCallback;

    frameRef = () => {
      rafId = requestAnimationFrame(frameRef);

      // Advance camera toward target
      cam.cx += (target.cx - cam.cx) * LERP_T;
      cam.sx += (target.sx - cam.sx) * LERP_T;
      cam.sy += (target.sy - cam.sy) * LERP_T;

      drawCurve();

      // Cancel loop when settled
      if (
        Math.abs(cam.cx - target.cx) < CAM_EPS &&
        Math.abs(cam.sx - target.sx) < CAM_EPS &&
        Math.abs(cam.sy - target.sy) < CAM_EPS
      ) {
        cancelAnimationFrame(rafId!);
        rafId = null;
        // Final exact frame at target position
        cam = { ...target };
        drawCurve();
      }
    };

    // Expose restartLoop for use by $effect
    restartLoop = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(frameRef);
      }
    };

    rafId = requestAnimationFrame(frameRef);

    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });

  // Update target bounds when g2/g3 change
  $effect(() => {
    void [g2, g3, cssW, cssH];

    // Always reset to auto-zoom when lattice shape changes, even if userCamera was active
    userCamera = false;

    const bounds = computeAxisBounds(g2, g3);
    const newTarget = boundsToCam(bounds);

    if (!camInitialized) {
      cam = { ...newTarget };
      camInitialized = true;
    }

    target = newTarget;
    restartLoop();
  });

  function drawAxisTicks(
    c: CanvasRenderingContext2D,
    xMin: number,
    xMax: number,
    yMax: number,
  ) {
    const xStep = pickGridStep(xMax - xMin);
    const yStep = pickGridStep(2 * yMax);

    const toCanvas = (wx: number, wy: number) => ({
      x: ((wx - xMin) / (xMax - xMin)) * cssW,
      y: ((yMax - wy) / (2 * yMax)) * cssH,
    });

    // Helper to format numbers
    const formatValue = (step: number, val: number): string => {
      if (step < 0.1) return val.toFixed(2);
      if (step < 1) return val.toFixed(1);
      return val.toFixed(0);
    };

    // Warm-white theme for ticks and labels
    c.strokeStyle = "rgba(230, 210, 190, 0.6)";
    c.lineWidth = 1;
    c.fillStyle = "rgba(240, 220, 200, 0.8)";
    c.font = "9px monospace";

    const origin = toCanvas(0, 0);

    // X-axis ticks and labels
    if (origin.y >= 0 && origin.y <= cssH) {
      const xStart = Math.ceil(xMin / xStep) * xStep;
      for (let x = xStart; x <= xMax; x += xStep) {
        if (Math.abs(x) < 1e-10) continue; // skip origin
        const px = toCanvas(x, 0).x;
        if (px >= 0 && px <= cssW) {
          // Tick mark
          c.beginPath();
          c.moveTo(px, origin.y - 2);
          c.lineTo(px, origin.y + 2);
          c.stroke();

          // Label (fade near edges)
          const label = formatValue(xStep, x);
          const textW = c.measureText(label).width;
          const labelX = px - textW / 2;

          // Skip label if within 6px of edge
          if (labelX >= 6 && labelX + textW <= cssW - 6) {
            c.textAlign = "left";
            c.textBaseline = "top";
            c.fillText(label, labelX, origin.y + 4);
          }
        }
      }
    }

    // Y-axis ticks and labels
    if (origin.x >= 0 && origin.x <= cssW) {
      const yStart = Math.ceil(-yMax / yStep) * yStep;
      for (let y = yStart; y <= yMax; y += yStep) {
        if (Math.abs(y) < 1e-10) continue; // skip origin
        const py = toCanvas(0, y).y;
        if (py >= 0 && py <= cssH) {
          // Tick mark
          c.beginPath();
          c.moveTo(origin.x - 2, py);
          c.lineTo(origin.x + 2, py);
          c.stroke();

          // Label
          const label = formatValue(yStep, y);
          const labelY = py - 4;

          // Skip label if within 6px of edge
          if (labelY >= 6 && labelY <= cssH - 6) {
            c.textAlign = "right";
            c.textBaseline = "bottom";
            c.fillText(label, origin.x - 4, labelY);
          }
        }
      }
    }
  }

  function drawGrid(
    c: CanvasRenderingContext2D,
    xMin: number,
    xMax: number,
    yMax: number,
  ) {
    // Grid lines at nice round intervals
    const xStep = pickGridStep(xMax - xMin);
    const yStep = pickGridStep(2 * yMax);

    // Coordinate transform: world (x,y) → canvas pixel (cx,cy)
    const toCanvas = (wx: number, wy: number) => ({
      x: ((wx - xMin) / (xMax - xMin)) * cssW,
      y: ((yMax - wy) / (2 * yMax)) * cssH,
    });

    // Interior grid lines — warm-white
    c.strokeStyle = "rgba(220, 200, 180, 0.1)";
    c.lineWidth = 1;

    // Vertical grid lines
    const xStart = Math.ceil(xMin / xStep) * xStep;
    for (let x = xStart; x <= xMax; x += xStep) {
      if (Math.abs(x) < 1e-10) continue; // skip x=0, will draw as axis
      const px = toCanvas(x, 0).x;
      if (px >= 0 && px <= cssW) {
        c.beginPath();
        c.moveTo(px, 0);
        c.lineTo(px, cssH);
        c.stroke();
      }
    }

    // Horizontal grid lines
    const yStart = Math.ceil(-yMax / yStep) * yStep;
    for (let y = yStart; y <= yMax; y += yStep) {
      if (Math.abs(y) < 1e-10) continue; // skip y=0, will draw as axis
      const py = toCanvas(0, y).y;
      if (py >= 0 && py <= cssH) {
        c.beginPath();
        c.moveTo(0, py);
        c.lineTo(cssW, py);
        c.stroke();
      }
    }

    // Axis lines (x=0, y=0) — warm-white
    c.strokeStyle = "rgba(220, 200, 180, 0.3)";
    c.lineWidth = 1;

    const origin = toCanvas(0, 0);
    if (origin.y >= 0 && origin.y <= cssH) {
      c.beginPath();
      c.moveTo(0, origin.y);
      c.lineTo(cssW, origin.y);
      c.stroke();
    }
    if (origin.x >= 0 && origin.x <= cssW) {
      c.beginPath();
      c.moveTo(origin.x, 0);
      c.lineTo(origin.x, cssH);
      c.stroke();
    }
  }

  function drawCurve() {
    if (!canvas || cssW <= 0 || cssH <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // TypeScript narrowing helper — ctx is definitely not null from here on
    const c = ctx as CanvasRenderingContext2D;

    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reconstruct viewport from camera state
    const { xMin, xMax, yMax } = camToViewport(cam);

    // Background
    c.fillStyle = "#171210";
    c.fillRect(0, 0, cssW, cssH);

    // Coordinate transform: world (x,y) → canvas pixel (cx,cy)
    const toCanvas = (wx: number, wy: number) => ({
      x: ((wx - xMin) / (xMax - xMin)) * cssW,
      y: ((yMax - wy) / (2 * yMax)) * cssH,
    });

    // ── Grid (if enabled) ──────────────────────────────────────────────────
    if (showGrid) {
      drawGrid(c, xMin, xMax, yMax);
      drawAxisTicks(c, xMin, xMax, yMax);
    } else {
      // Draw axes only when grid is off
      c.strokeStyle = "rgba(255, 255, 255, 0.2)";
      c.lineWidth = 1;

      const origin = toCanvas(0, 0);
      if (origin.y >= 0 && origin.y <= cssH) {
        c.beginPath();
        c.moveTo(0, origin.y);
        c.lineTo(cssW, origin.y);
        c.stroke();
      }
      if (origin.x >= 0 && origin.x <= cssW) {
        c.beginPath();
        c.moveTo(origin.x, 0);
        c.lineTo(origin.x, cssH);
        c.stroke();
      }
    }

    // ── Curve branches ───────────────────────────────────────────────────

    c.strokeStyle = "rgba(255, 200, 130, 0.9)";
    c.lineWidth = 1.5;
    c.lineJoin = "round";

    function drawBranch(branch: Branch) {
      // Draw yPos branch
      c.beginPath();
      for (let i = 0; i < branch.xs.length; i++) {
        const pt = toCanvas(branch.xs[i], branch.yPos[i]);
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
      }
      c.stroke();

      // Draw yNeg branch
      c.beginPath();
      for (let i = 0; i < branch.xs.length; i++) {
        const pt = toCanvas(branch.xs[i], branch.yNeg[i]);
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
      }
      c.stroke();
    }

    // Sample and draw each real component
    for (const [lo, hi] of realIntervals(g2, g3)) {
      const branch = sampleInterval(g2, g3, lo, hi, xMax, 200);
      drawBranch(branch);
    }

    // ── Root markers ─────────────────────────────────────────────────────

    c.fillStyle = "rgba(255, 155, 50, 0.95)";
    for (const r of cubicRoots(g2, g3)) {
      if (!Number.isFinite(r)) continue;
      const pt = toCanvas(r, 0);
      c.beginPath();
      c.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      c.fill();
    }

    // ── Label ────────────────────────────────────────────────────────────

    c.fillStyle = "rgba(255, 220, 180, 0.45)";
    c.font = "11px monospace";
    c.textAlign = "left";
    c.textBaseline = "bottom";
    c.fillText("y² = 4x³ − g₂x − g₃", 8, cssH - 4);
  }

  // ── Pan/Zoom Event Handlers ────────────────────────────────────────────────

  function handleWheel(e: WheelEvent) {
    if (!canvas || cssW <= 0 || cssH <= 0) return;
    e.preventDefault();

    userCamera = true;  // Activate manual camera mode

    // Get cursor position
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Convert cursor to world coords
    const { xMin, xMax, yMax } = camToViewport(cam);
    const wx = xMin + (px / cssW) * (xMax - xMin);
    const wy = yMax - (py / cssH) * (2 * yMax);

    // Zoom around cursor — both x and y
    const zoomFactor = e.deltaY > 0 ? 1 + ZOOM_SPEED : 1 - ZOOM_SPEED;
    const newSx = cam.sx + Math.log(zoomFactor);
    const newSy = cam.sy + Math.log(zoomFactor);

    // Adjust centers to keep cursor fixed
    const hwOld = Math.exp(cam.sx) / 2;
    const hwNew = Math.exp(newSx) / 2;
    const newCx = wx - (wx - cam.cx) * (hwNew / hwOld);

    const hhOld = Math.exp(cam.sy) / 2;
    const hhNew = Math.exp(newSy) / 2;
    // Vertical zoom doesn't affect center since curve is y-symmetric about origin
    // but we still zoom uniformly for consistency

    target = { ...cam, cx: newCx, sx: newSx, sy: newSy };
    restartLoop();
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Left button only
    userCamera = true;
    dragStart = { px: e.clientX, cx: cam.cx };
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragStart) return;

    const { xMin, xMax } = camToViewport(cam);
    const pxDelta = e.clientX - dragStart.px;
    const worldDelta = -(pxDelta / cssW) * (xMax - xMin);
    const newCx = dragStart.cx + worldDelta;

    cam.cx = newCx;
    target.cx = newCx;
    drawCurve();
  }

  function handleMouseUp() {
    dragStart = null;
  }

  function handleDoubleClick() {
    // Reset to auto-zoom
    userCamera = false;
    const bounds = computeAxisBounds(g2, g3);
    target = boundsToCam(bounds);
    restartLoop();
  }
</script>

<div class="curve-section" class:fill-viewport={fillViewport}>
  <div class="canvas-stack" bind:this={container}>
    <canvas
      bind:this={canvas}
      width={320}
      height={240}
      class="curve-canvas"
      onwheel={handleWheel}
      onmousedown={handleMouseDown}
      ondblclick={handleDoubleClick}
    ></canvas>
  </div>
</div>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

<style>
  .curve-section {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .curve-section.fill-viewport {
    width: 100%;
    height: 100%;
  }
  .canvas-stack {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border: 1px solid rgba(255, 150, 60, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }
  .fill-viewport .canvas-stack {
    flex: 1;
    aspect-ratio: unset;
    height: 100%;
    border: none;
    border-radius: 0;
  }
  .curve-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
