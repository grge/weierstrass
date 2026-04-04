<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    computeAxisBounds,
    cubicRoots,
    realIntervals,
    sampleInterval,
  } from "$lib/curve";
  import type { Branch } from "$lib/curve";

  let {
    g2 = 0,
    g3 = 0,
  }: {
    g2: number;
    g3: number;
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
  let rafId: number | null = null;
  let restartLoop: () => void = () => {};

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

    const bounds = computeAxisBounds(g2, g3);
    const newTarget = boundsToCam(bounds);

    if (!camInitialized) {
      cam = { ...newTarget };
      camInitialized = true;
    }

    target = newTarget;
    restartLoop();
  });

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

    // ── Axes ──────────────────────────────────────────────────────────────

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

    // ── Curve branches ───────────────────────────────────────────────────

    c.strokeStyle = "rgba(120, 200, 255, 0.85)";
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

    c.fillStyle = "rgba(255, 200, 80, 0.9)";
    for (const r of cubicRoots(g2, g3)) {
      if (!Number.isFinite(r)) continue;
      const pt = toCanvas(r, 0);
      c.beginPath();
      c.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
      c.fill();
    }

    // ── Label ────────────────────────────────────────────────────────────

    c.fillStyle = "rgba(255, 220, 180, 0.35)";
    c.font = "11px monospace";
    c.textAlign = "left";
    c.textBaseline = "bottom";
    c.fillText("y² = 4x³ − g₂x − g₃", 8, cssH - 4);
  }
</script>

<div class="curve-section">
  <div class="canvas-stack" bind:this={container}>
    <canvas bind:this={canvas} width={320} height={240} class="curve-canvas"></canvas>
  </div>
</div>

<style>
  .curve-section {
    padding: 0;
  }
  .canvas-stack {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border: 1px solid rgba(255, 150, 60, 0.12);
    border-radius: 4px;
    overflow: hidden;
  }
  .curve-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
