<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    computeAxisBounds,
    cubicRoots,
    realIntervals,
    sampleInterval,
  } from "$lib/curve";
  import { drawGridWithTicksXY } from "$lib/grid-renderer";
  import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "$lib/overlay-styles";
  import { createLerpLoop } from "$lib/lerp-loop";
  import type { LerpLoop } from "$lib/lerp-loop";
  import { observeSize } from "$lib/canvas-size";
  import type { Branch } from "$lib/curve";

  // ── Props ──────────────────────────────────────────────────────────────────

  let {
    g2 = 0,
    g3 = 0,
    fillViewport = false,
    showGrid = false,
  }: {
    g2: number;
    g3: number;
    fillViewport?: boolean;
    showGrid?: boolean;
  } = $props();

  // ── DOM refs ───────────────────────────────────────────────────────────────

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cssW = $state(320);
  let cssH = $state(240);

  // ── Camera / view state ────────────────────────────────────────────────────
  // Log-scale coordinate system:
  //   cx = centre x = (xMin + xMax) / 2
  //   sx = log of x-width = log(xMax - xMin)
  //   sy = log of y-height = log(2 * yMax)

  type CamState = { cx: number; sx: number; sy: number };

  let cam: CamState    = { cx: 0, sx: Math.log(4), sy: Math.log(4) };
  let target: CamState = { cx: 0, sx: Math.log(4), sy: Math.log(4) };
  let camInitialized = false;
  let userCamera = $state(false);  // true = manual pan/zoom, false = auto-zoom
  let loop: LerpLoop | null = null;

  const LERP_T    = 0.15;
  const CAM_EPS   = 1e-4;
  const ZOOM_SPEED = 0.1;

  // Pan drag state
  let dragStart: { px: number; cx: number } | null = null;

  // ── Coordinate transforms ──────────────────────────────────────────────────

  function camToViewport(c: CamState): { xMin: number; xMax: number; yMax: number } {
    const hw = Math.exp(c.sx) / 2;
    const hh = Math.exp(c.sy) / 2;
    return { xMin: c.cx - hw, xMax: c.cx + hw, yMax: hh };
  }

  function boundsToCam(b: { xMin: number; xMax: number; yMax: number }): CamState {
    return {
      cx: (b.xMin + b.xMax) / 2,
      sx: Math.log(b.xMax - b.xMin),
      sy: Math.log(2 * b.yMax),
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function drawFrame() {
    if (!canvas || cssW <= 0 || cssH <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = ctx as CanvasRenderingContext2D;

    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { xMin, xMax, yMax } = camToViewport(cam);

    // Coordinate transform: world (x,y) → CSS pixel (cx,cy)
    const toCanvas = (wx: number, wy: number) => ({
      x: ((wx - xMin) / (xMax - xMin)) * cssW,
      y: ((yMax - wy) / (2 * yMax)) * cssH,
    });

    // Background
    c.fillStyle = "#171210";
    c.fillRect(0, 0, cssW, cssH);

    // ── Grid ──────────────────────────────────────────────────────────────
    drawGridWithTicksXY(
      c,
      { min: xMin, max: xMax },
      { min: -yMax, max: yMax },
      (worldX: number) => ((worldX - xMin) / (xMax - xMin)) * cssW,
      (worldY: number) => ((yMax - worldY) / (2 * yMax)) * cssH,
      cssW,
      cssH,
      {
        showGrid,
        showTicks: true,
        showLabels: true,
        tickSize: 2,
        labelOffset: 4,
        labelFont: "9px monospace",
        edgeClip: 6,
      },
    );

    // ── Axes ──────────────────────────────────────────────────────────────
    const origin = toCanvas(0, 0);
    if (!showGrid) {
      c.strokeStyle = OVERLAY_COLORS.gridAxisNoGrid;
      c.lineWidth = OVERLAY_WEIGHTS.thin;
    } else {
      c.strokeStyle = OVERLAY_COLORS.gridAxis;
      c.lineWidth = OVERLAY_WEIGHTS.normal;
    }
    if (origin.y >= 0 && origin.y <= cssH) {
      c.beginPath(); c.moveTo(0, origin.y); c.lineTo(cssW, origin.y); c.stroke();
    }
    if (origin.x >= 0 && origin.x <= cssW) {
      c.beginPath(); c.moveTo(origin.x, 0); c.lineTo(origin.x, cssH); c.stroke();
    }

    // ── Curve branches ────────────────────────────────────────────────────
    c.strokeStyle = "rgba(255, 200, 130, 0.9)";
    c.lineWidth = 1.5;
    c.lineJoin = "round";

    function drawBranch(branch: Branch) {
      c.beginPath();
      for (let i = 0; i < branch.xs.length; i++) {
        const pt = toCanvas(branch.xs[i], branch.yPos[i]);
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
      }
      c.stroke();

      c.beginPath();
      for (let i = 0; i < branch.xs.length; i++) {
        const pt = toCanvas(branch.xs[i], branch.yNeg[i]);
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
      }
      c.stroke();
    }

    for (const [lo, hi] of realIntervals(g2, g3)) {
      const branch = sampleInterval(g2, g3, lo, hi, xMax, 200);
      drawBranch(branch);
    }

    // ── Root markers ──────────────────────────────────────────────────────
    c.fillStyle = "rgba(255, 155, 50, 0.95)";
    for (const r of cubicRoots(g2, g3)) {
      if (!Number.isFinite(r)) continue;
      const pt = toCanvas(r, 0);
      c.beginPath();
      c.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      c.fill();
    }

    // ── Equation label ────────────────────────────────────────────────────
    c.fillStyle = "rgba(255, 220, 180, 0.45)";
    c.font = "11px monospace";
    c.textAlign = "left";
    c.textBaseline = "bottom";
    c.fillText("y² = 4x³ − g₂x − g₃", 8, cssH - 4);
  }

  // ── Interaction handlers ───────────────────────────────────────────────────

  function handleWheel(e: WheelEvent) {
    if (!canvas || cssW <= 0 || cssH <= 0) return;
    e.preventDefault();

    userCamera = true;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const { xMin, xMax, yMax } = camToViewport(cam);
    const wx = xMin + (px / cssW) * (xMax - xMin);
    const wy = yMax - (py / cssH) * (2 * yMax);

    const zoomFactor = e.deltaY > 0 ? 1 + ZOOM_SPEED : 1 - ZOOM_SPEED;
    const newSx = cam.sx + Math.log(zoomFactor);
    const newSy = cam.sy + Math.log(zoomFactor);

    const hwOld = Math.exp(cam.sx) / 2;
    const hwNew = Math.exp(newSx) / 2;
    const newCx = wx - (wx - cam.cx) * (hwNew / hwOld);

    target = { ...cam, cx: newCx, sx: newSx, sy: newSy };
    loop?.restart();
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    userCamera = true;
    dragStart = { px: e.clientX, cx: cam.cx };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!dragStart) return;
    const { xMin, xMax } = camToViewport(cam);
    const pxDelta = e.clientX - dragStart.px;
    const worldDelta = -(pxDelta / cssW) * (xMax - xMin);
    const newCx = dragStart.cx + worldDelta;
    cam.cx = newCx;
    target.cx = newCx;
    drawFrame();
  }

  function handlePointerUp() {
    dragStart = null;
  }

  function handleDoubleClick() {
    userCamera = false;
    const bounds = computeAxisBounds(g2, g3);
    target = boundsToCam(bounds);
    loop?.restart();
  }

  // ── Mount / lifecycle ──────────────────────────────────────────────────────

  onMount(() => {
    const stopObserving = observeSize(container, (w, h) => {
      untrack(() => { cssW = w; cssH = h; });
    });

    loop = createLerpLoop({
      onFrame() {
        cam.cx += (target.cx - cam.cx) * LERP_T;
        cam.sx += (target.sx - cam.sx) * LERP_T;
        cam.sy += (target.sy - cam.sy) * LERP_T;
        drawFrame();
      },
      isSettled() {
        return Math.abs(cam.cx - target.cx) < CAM_EPS &&
               Math.abs(cam.sx - target.sx) < CAM_EPS &&
               Math.abs(cam.sy - target.sy) < CAM_EPS;
      },
      onSettle() {
        cam = { ...target };
        drawFrame();
      },
    });
    loop.restart();

    return () => {
      stopObserving();
      loop?.destroy();
    };
  });

  // ── Reactive triggers ──────────────────────────────────────────────────────

  $effect(() => {
    void [g2, g3, cssW, cssH];

    userCamera = false;

    const bounds = computeAxisBounds(g2, g3);
    const newTarget = boundsToCam(bounds);

    if (!camInitialized) {
      cam = { ...newTarget };
      camInitialized = true;
    }

    target = newTarget;
    loop?.restart();
  });

  $effect(() => {
    showGrid;
    drawFrame();
  });
</script>

<div class="view-section" class:fill-viewport={fillViewport}>
  <div class="canvas-stack" bind:this={container}>
    <canvas
      bind:this={canvas}
      width={320}
      height={240}
      class="main-canvas"
      onwheel={handleWheel}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
      ondblclick={handleDoubleClick}
    ></canvas>
  </div>
</div>

<style>
  .view-section {
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .view-section.fill-viewport {
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
  .main-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
  }
</style>
