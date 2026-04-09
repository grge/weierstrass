<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    computeAxisBounds,
    computeG2G3,
    cubicRoots,
    realIntervals,
    sampleInterval,
    sampleStepsForViewport,
    visibleIntervalSegment,
    type Branch,
  } from "$lib/curve";
  import { drawGridWithTicksXY } from "$lib/grid-renderer";
  import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "$lib/overlay-styles";
  import { createLerpLoop } from "$lib/lerp-loop";
  import type { LerpLoop } from "$lib/lerp-loop";
  import { observeSize } from "$lib/canvas-size";
  import type { Vec2 } from "$lib/types";

  let {
    omega1,
    omega2,
    fillViewport = false,
    showGrid = false,
  }: {
    omega1: Vec2;
    omega2: Vec2;
    fillViewport?: boolean;
    showGrid?: boolean;
  } = $props();

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cssW = $state(320);
  let cssH = $state(240);

  type CamState = { cx: number; sx: number; sy: number };

  let cam: CamState    = { cx: 0, sx: Math.log(4), sy: Math.log(4) };
  let target: CamState = { cx: 0, sx: Math.log(4), sy: Math.log(4) };
  let camInitialized = false;
  let userCamera = $state(false);
  let loop: LerpLoop | null = null;

  const LERP_T = 0.15;
  const CAM_EPS = 1e-4;
  const ZOOM_SPEED = 0.1;

  let panDragStart: { px: number; cx: number } | null = null;

  const curveData = $derived.by(() => {
    const coeffs = computeG2G3(omega1, omega2);
    return { g2: coeffs.g2, g3: coeffs.g3, roots: cubicRoots(coeffs.g2, coeffs.g3) };
  });

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

  function worldToCanvas(wx: number, wy: number, viewport: { xMin: number; xMax: number; yMax: number }) {
    return {
      x: ((wx - viewport.xMin) / (viewport.xMax - viewport.xMin)) * cssW,
      y: ((viewport.yMax - wy) / (2 * viewport.yMax)) * cssH,
    };
  }

  function drawRootDot(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = "rgba(255, 185, 95, 0.95)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

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

    const viewport = camToViewport(cam);
    const { xMin, xMax, yMax } = viewport;
    const { g2, g3, roots } = curveData;
    const toCanvas = (wx: number, wy: number) => worldToCanvas(wx, wy, viewport);

    c.fillStyle = "#171210";
    c.fillRect(0, 0, cssW, cssH);

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

    c.lineJoin = "round";

    function drawBranch(branch: Branch) {
      c.strokeStyle = "rgba(255, 200, 130, 0.95)";
      c.lineWidth = 1.6;

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

    const xPad = 0.08 * (xMax - xMin);
    for (const [lo, hi] of realIntervals(g2, g3)) {
      const segment = visibleIntervalSegment(lo, hi, xMin, xMax, xPad);
      if (!segment) continue;
      const [segLo, segHi] = segment;
      const segRight = segHi ?? (xMax + xPad);
      const steps = sampleStepsForViewport(segLo, segRight, cssW);
      const branch = sampleInterval(g2, g3, segLo, segHi, xMax + xPad, steps);
      drawBranch(branch);
    }

    for (const x of roots) {
      const pt = toCanvas(x, 0);
      drawRootDot(c, pt.x, pt.y);
    }

    c.fillStyle = "rgba(255, 220, 180, 0.45)";
    c.font = "11px monospace";
    c.textAlign = "left";
    c.textBaseline = "bottom";
    c.fillText("y² = 4x³ − g₂x − g₃", 8, cssH - 4);
  }

  function handleWheel(e: WheelEvent) {
    if (!canvas || cssW <= 0 || cssH <= 0) return;
    e.preventDefault();

    userCamera = true;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const { xMin, xMax } = camToViewport(cam);
    const wx = xMin + (px / cssW) * (xMax - xMin);

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
    panDragStart = { px: e.clientX, cx: cam.cx };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!panDragStart) return;
    const { xMin, xMax } = camToViewport(cam);
    const pxDelta = e.clientX - panDragStart.px;
    const worldDelta = -(pxDelta / cssW) * (xMax - xMin);
    const newCx = panDragStart.cx + worldDelta;
    cam.cx = newCx;
    target.cx = newCx;
    drawFrame();
  }

  function handlePointerUp() {
    panDragStart = null;
  }

  function handleDoubleClick() {
    userCamera = false;
    const bounds = computeAxisBounds(curveData.g2, curveData.g3);
    target = boundsToCam(bounds);
    loop?.restart();
  }

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

  $effect(() => {
    void [curveData.g2, curveData.g3, cssW, cssH];

    userCamera = false;

    const bounds = computeAxisBounds(curveData.g2, curveData.g3);
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
    curveData.roots;
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
