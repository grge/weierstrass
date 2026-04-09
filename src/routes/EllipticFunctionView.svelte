<script lang="ts">
  import { onMount, untrack } from "svelte";

  import { createResources, destroyResources, render, compileExpressionProgram } from "$lib/elliptic-function-renderer";
  import { worldToScreen, screenToWorld, clamp, findWeierstrassZeros } from "$lib/math";
  import { toLatticeCoords } from "$lib/lattice";
  import { drawGridWithTicksXY } from "$lib/grid-renderer";
  import { OVERLAY_COLORS, OVERLAY_WEIGHTS } from "$lib/overlay-styles";
  import { createLerpLoop } from "$lib/lerp-loop";
  import type { LerpLoop } from "$lib/lerp-loop";
  import { observeSize, getDevicePixelRatio } from "$lib/canvas-size";
  import { drawHandle, drawAxesXY, drawVectorArrow, drawOriginDot } from "$lib/overlay-draw";
  import type { Vec2, DragState, GLResources, RenderMode, ViewMode } from "$lib/types";

  // ── Props ──────────────────────────────────────────────────────────────────

  let {
    omega1,
    omega2,
    tau,
    mode,
    halo,
    tileSize,
    terms = 5,
    showGrid,
    showLattice,
    showCell,
    showSpecialPoints,
    showHalo,
    showOmega,
    viewMode = $bindable("plane"),
    tileUpdatesPerSec = $bindable(0),
    exprGlslBody = "",
    expr = "wp",
    g2 = 0,
    g3 = 0,
    showOverlay = true,
    onBasisChange,
  }: {
    omega1: Vec2; omega2: Vec2;
    tau: Vec2; mode: RenderMode; halo: number; tileSize: number; terms?: number;
    showGrid: boolean; showLattice: boolean; showCell: boolean;
    showSpecialPoints: boolean; showHalo: boolean; showOmega: boolean; viewMode?: ViewMode;
    tileUpdatesPerSec?: number;
    exprGlslBody?: string;
    expr?: string;
    g2?: number;
    g3?: number;
    showOverlay?: boolean;
    onBasisChange?: (omega1: Vec2, omega2: Vec2) => void;
  } = $props();

  // ── View-internal state (camera) ───────────────────────────────────────────
  
  let zoom: number = $state(1.6);
  let pan: Vec2 = $state({ x: 0.8, y: 0.7 });

  // ── DOM refs / GL resources ────────────────────────────────────────────────

  let container: HTMLDivElement;
  let glCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;
  let resources: GLResources | null = null;
  let resourceVersion = $state(0);
  let sizeVersion = $state(0);  // bumped on resize to trigger re-render

  // ── Camera / view state ────────────────────────────────────────────────────
  // zoom/pan are view-internal state; camZoom/camPan are the smoothed current state.
  // The RAF loop lerps cam → internal targets and renders each frame.

  let camZoom = zoom;
  let camPanX = pan.x;
  let camPanY = pan.y;
  let loop: LerpLoop | null = null;

  const LERP_T = 0.14;
  const CAM_EPS = 1e-5;

  // ── Interaction state ──────────────────────────────────────────────────────

  let drag: DragState | null = null;
  let hoverAnchor: "omega1" | "omega2" | null = $state(null);

  // ── Derived state ──────────────────────────────────────────────────────────

  let prevZerosRef: Vec2[] = [];
  let zeros: Vec2[] = $state([]);
  let _tileRenderCount = 0;  // raw counter, sampled every second

  // ── Coordinate transforms ──────────────────────────────────────────────────

  /** World point → fractional lattice UV coords in [0,1)² */
  function toLatticeUV(z: Vec2): Vec2 {
    const uv = toLatticeCoords(z, omega1, omega2);
    return { x: ((uv.x % 1) + 1) % 1, y: ((uv.y % 1) + 1) % 1 };
  }

  /** Lattice coords of a world point: z = m·ω₁ + n·ω₂ → {m, n} */
  function toLattice(z: Vec2): Vec2 {
    return toLatticeCoords(z, omega1, omega2);
  }

  /** Find the integer lattice range visible on screen, with padding and a hard cap. */
  function visibleLatticeRange(w: number, h: number) {
    const corners = [
      screenToWorld(0, 0, w, h, camPanX, camPanY, camZoom),
      screenToWorld(w, 0, w, h, camPanX, camPanY, camZoom),
      screenToWorld(0, h, w, h, camPanX, camPanY, camZoom),
      screenToWorld(w, h, w, h, camPanX, camPanY, camZoom),
    ].map(toLattice);
    const ms = corners.map(c => c.x);
    const ns = corners.map(c => c.y);
    const CAP = 18;
    return {
      mMin: Math.max(Math.floor(Math.min(...ms)) - 1, -CAP),
      mMax: Math.min(Math.ceil( Math.max(...ms)) + 1,  CAP),
      nMin: Math.max(Math.floor(Math.min(...ns)) - 1, -CAP),
      nMax: Math.min(Math.ceil( Math.max(...ns)) + 1,  CAP),
    };
  }

  function ws(x: number, y: number, w: number, h: number) {
    return worldToScreen(x, y, w, h, camPanX, camPanY, camZoom);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function drawFrame() {
    if (!resources || !glCanvas || !overlayCanvas) return;
    const dpr = getDevicePixelRatio();
    const w = Math.max(1, Math.floor(container.clientWidth  * dpr));
    const h = Math.max(1, Math.floor(container.clientHeight * dpr));
    if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h; }
    if (overlayCanvas.width !== w || overlayCanvas.height !== h) { overlayCanvas.width = w; overlayCanvas.height = h; }

    render(resources, {
      omega1, omega2, tau,
      zoom: camZoom,
      pan: { x: camPanX, y: camPanY },
      mode,
      halo: showHalo ? halo : 0,
      viewMode, terms,
      width: w, height: h,
      g2, g3,
    });
    _tileRenderCount++;

    drawOverlay(overlayCanvas, w, h, dpr, zeros);
  }

  function drawOverlay(canvas: HTMLCanvasElement, w: number, h: number, dpr: number, zeros: Vec2[]) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // ── a) complex grid ──────────────────────────────────────────────────────
    if (showGrid && viewMode === "plane") {
      const tl = screenToWorld(0, 0, w, h, camPanX, camPanY, camZoom);
      const br = screenToWorld(w, h, w, h, camPanX, camPanY, camZoom);
      const xMin = Math.min(tl.x, br.x);
      const xMax = Math.max(tl.x, br.x);
      const yMin = Math.min(tl.y, br.y);
      const yMax = Math.max(tl.y, br.y);

      drawGridWithTicksXY(
        ctx,
        { min: xMin, max: xMax },
        { min: yMin, max: yMax },
        (worldX: number) => ws(worldX, 0, w, h).x,
        (worldY: number) => ws(0, worldY, w, h).y,
        w, h,
        {
          showGrid: true,
          showTicks: true,
          showLabels: true,
          tickSize: 4 * dpr,
          labelOffset: 4 * dpr,
          labelFont: `${Math.round(9 * dpr)}px monospace`,
          edgeClip: 6,
        },
      );
      const axisOrigin = ws(0, 0, w, h);
      drawAxesXY(ctx, axisOrigin.x, axisOrigin.y, w, h, dpr);
    }

    // ── b) cell lattice grid ─────────────────────────────────────────────────
    if (showLattice && viewMode === "plane") {
      const { mMin, mMax, nMin, nMax } = visibleLatticeRange(w, h);
      ctx.strokeStyle = OVERLAY_COLORS.lattice;
      ctx.lineWidth = OVERLAY_WEIGHTS.thin * dpr;
      for (let m = mMin; m <= mMax; m++) {
        for (let n = nMin; n <= nMax; n++) {
          const ox = m * omega1.x + n * omega2.x;
          const oy = m * omega1.y + n * omega2.y;
          const s0 = ws(ox, oy, w, h);
          const s1 = ws(ox + omega1.x, oy + omega1.y, w, h);
          const s2 = ws(ox + omega2.x, oy + omega2.y, w, h);
          ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
        }
      }
    }

    // ── c) fundamental cell outline ──────────────────────────────────────────
    if (showCell && viewMode === "plane") {
      const origin = ws(0, 0, w, h);
      const p1 = ws(omega1.x, omega1.y, w, h);
      const p2 = ws(omega1.x + omega2.x, omega1.y + omega2.y, w, h);
      const p3 = ws(omega2.x, omega2.y, w, h);
      ctx.strokeStyle = OVERLAY_COLORS.cell;
      ctx.lineWidth = OVERLAY_WEIGHTS.normal * dpr;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── d) poles and half-period markers ─────────────────────────────────────
    if (showSpecialPoints) {
      const R = 7 * dpr;

      if (viewMode === "torus") {
        const uvToScreen = (uv: Vec2) => ({ x: uv.x * w, y: uv.y * h });

        const drawCross = (s: {x:number,y:number}) => {
          ctx.beginPath(); ctx.moveTo(s.x - R, s.y - R); ctx.lineTo(s.x + R, s.y + R); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x + R, s.y - R); ctx.lineTo(s.x - R, s.y + R); ctx.stroke();
        };

        const poleUVs = [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}];
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 7 * dpr;
        for (const uv of poleUVs) drawCross(uvToScreen(uv));
        ctx.strokeStyle = "rgba(0,0,0,1.0)"; ctx.lineWidth = 2.5 * dpr;
        for (const uv of poleUVs) drawCross(uvToScreen(uv));

        for (const z0 of zeros) {
          const uv = toLatticeUV(z0);
          const s = uvToScreen(uv);
          ctx.strokeStyle = "rgba(0,0,0,0.85)";     ctx.lineWidth = 7 * dpr;
          ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,1.0)"; ctx.lineWidth = 2.5 * dpr;
          ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.stroke();
        }
      } else {
        const { mMin, mMax, nMin, nMax } = visibleLatticeRange(w, h);

        const drawPoles = () => {
          for (let m = mMin; m <= mMax; m++) {
            for (let n = nMin; n <= nMax; n++) {
              const s = ws(m * omega1.x + n * omega2.x, m * omega1.y + n * omega2.y, w, h);
              ctx.beginPath(); ctx.moveTo(s.x - R, s.y - R); ctx.lineTo(s.x + R, s.y + R); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(s.x + R, s.y - R); ctx.lineTo(s.x - R, s.y + R); ctx.stroke();
            }
          }
        };
        const drawZeros = () => {
          for (const z0 of zeros) {
            for (let m = mMin; m <= mMax; m++) {
              for (let n = nMin; n <= nMax; n++) {
                const s = ws(z0.x + m * omega1.x + n * omega2.x, z0.y + m * omega1.y + n * omega2.y, w, h);
                ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.stroke();
              }
            }
          }
        };

        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"; ctx.lineWidth = 7 * dpr; drawPoles();
        ctx.strokeStyle = "rgba(0, 0, 0, 1.0)";        ctx.lineWidth = 2.5 * dpr; drawPoles();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";       ctx.lineWidth = 7 * dpr; drawZeros();
        ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";  ctx.lineWidth = 2.5 * dpr; drawZeros();
      }
    }

    // ── e) ω vectors ─────────────────────────────────────────────────────────
    if (showOmega && viewMode === "plane") {
      const origin = ws(0, 0, w, h);
      const w1s = ws(omega1.x, omega1.y, w, h);
      const w2s = ws(omega2.x, omega2.y, w, h);

      drawVectorArrow(ctx, origin.x, origin.y, w1s.x, w1s.y, dpr);
      drawVectorArrow(ctx, origin.x, origin.y, w2s.x, w2s.y, dpr);
      drawOriginDot(ctx, origin.x, origin.y, dpr);

      drawHandle(ctx, w1s.x, w1s.y, "ω₁", hoverAnchor === "omega1" || drag?.kind === "omega1", dpr);
      drawHandle(ctx, w2s.x, w2s.y, "ω₂", hoverAnchor === "omega2" || drag?.kind === "omega2", dpr);
    }

    ctx.restore();
  }

  // ── Interaction handlers ───────────────────────────────────────────────────

  /**
   * Project `proposed` onto the half-space det(ω₁,ω₂) ≥ MIN_DET,
   * keeping the point as close as possible to where the pointer is.
   */
  function clampToPositiveDet(proposed: Vec2, fixed: Vec2, proposedIsOmega1: boolean): Vec2 {
    const MIN_DET = 1e-4;
    const d = proposedIsOmega1
      ? proposed.x * fixed.y  - proposed.y * fixed.x
      : fixed.x   * proposed.y - fixed.y  * proposed.x;
    if (d >= MIN_DET) return proposed;
    const [gx, gy] = proposedIsOmega1
      ? [ fixed.y, -fixed.x]
      : [-fixed.y,  fixed.x];
    const mag2 = gx * gx + gy * gy;
    if (mag2 < 1e-12) return proposed;
    const t = (MIN_DET - d) / mag2;
    return { x: proposed.x + t * gx, y: proposed.y + t * gy };
  }

  function pointerToWorld(e: PointerEvent): Vec2 {
    const dpr = getDevicePixelRatio();
    const rect = overlayCanvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width  * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    return screenToWorld((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr, w, h, pan.x, pan.y, zoom);
  }

  function anchorHitTest(e: PointerEvent): "omega1" | "omega2" | null {
    if (viewMode === "torus") return null;
    const dpr = getDevicePixelRatio();
    const rect = overlayCanvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const w1s = worldToScreen(omega1.x, omega1.y, w, h, pan.x, pan.y, zoom);
    const w2s = worldToScreen(omega2.x, omega2.y, w, h, pan.x, pan.y, zoom);
    if (Math.hypot(mx - w1s.x, my - w1s.y) < 18 * dpr) return "omega1";
    if (Math.hypot(mx - w2s.x, my - w2s.y) < 18 * dpr) return "omega2";
    return null;
  }

  function handlePointerDown(e: PointerEvent) {
    if (viewMode === "torus") return;
    const hit = anchorHitTest(e);
    if (hit === "omega1") drag = { kind: "omega1" };
    else if (hit === "omega2") drag = { kind: "omega2" };
    else drag = { kind: "pan", x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!drag) {
      hoverAnchor = anchorHitTest(e);
      return;
    }
    if (drag.kind === "pan") {
      const dpr = getDevicePixelRatio();
      const rect = overlayCanvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width  * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      const dx = (e.clientX - drag.x) * dpr;
      const dy = (e.clientY - drag.y) * dpr;
      drag = { kind: "pan", x: e.clientX, y: e.clientY };
      pan = {
        x: pan.x - dx / (zoom * Math.min(w, h) * 0.5),
        y: pan.y + dy / (zoom * Math.min(w, h) * 0.5),
      };
      camPanX = pan.x; camPanY = pan.y;
      hoverAnchor = null;
      return;
    }
    const next = pointerToWorld(e);
    if (drag.kind === "omega1") {
      onBasisChange?.(clampToPositiveDet(next, omega2, true), omega2);
    } else {
      onBasisChange?.(omega1, clampToPositiveDet(next, omega1, false));
    }
    hoverAnchor = drag.kind;
  }

  function handlePointerUp(e: PointerEvent) {
    drag = null;
    hoverAnchor = null;
    const rect = overlayCanvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom) {
      hoverAnchor = anchorHitTest(e);
    }
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }

  function handlePointerLeave() {
    hoverAnchor = null;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (viewMode === "torus") return;
    zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0012), 0.35, 10);
  }

  function handleDoubleClick() {
    if (viewMode === "torus") return;
    zoom = 0.8;
    pan = { x: 0.8, y: 0.7 };
  }

  // ── Mount / lifecycle ──────────────────────────────────────────────────────

  onMount(() => {
    const stopObserving = observeSize(container, () => {
      untrack(() => { sizeVersion++; });
    });

    const interval = setInterval(() => {
      untrack(() => { tileUpdatesPerSec = _tileRenderCount; });
      _tileRenderCount = 0;
    }, 1000);

    loop = createLerpLoop({
      onFrame() {
        camZoom += (zoom    - camZoom) * LERP_T;
        camPanX += (pan.x   - camPanX) * LERP_T;
        camPanY += (pan.y   - camPanY) * LERP_T;
        drawFrame();
      },
      isSettled() {
        return Math.abs(camZoom - zoom)  < CAM_EPS &&
               Math.abs(camPanX - pan.x) < CAM_EPS &&
               Math.abs(camPanY - pan.y) < CAM_EPS;
      },
      onSettle() {
        camZoom = zoom; camPanX = pan.x; camPanY = pan.y;
        drawFrame();
      },
    });
    loop.restart();

    return () => {
      stopObserving();
      clearInterval(interval);
      loop?.destroy();
    };
  });

  // ── Reactive triggers ──────────────────────────────────────────────────────

  // GL resource lifecycle: recreate when tileSize changes
  $effect(() => {
    const ts = tileSize;
    if (!glCanvas) return;
    const gl = glCanvas.getContext("webgl2", {
      antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) return;
    if (resources) destroyResources(resources);
    try {
      resources = createResources(gl, ts);
      untrack(() => { resourceVersion++; });
      if (exprGlslBody && resources) compileExpressionProgram(resources, exprGlslBody);
    } catch (err) {
      console.error("Failed to create resources:", err);
      resources = null;
    }
    return () => { if (resources) { destroyResources(resources); resources = null; } };
  });

  // Zero-finding: recompute when lattice or terms changes
  $effect(() => {
    const nextZeros = findWeierstrassZeros(omega1, omega2, prevZerosRef, terms);
    prevZerosRef = nextZeros;
    zeros = nextZeros;
  });

  // Expression compilation: recompile tile shader when GLSL body changes
  $effect(() => {
    exprGlslBody;  // dependency
    if (!resources || !exprGlslBody) return;
    compileExpressionProgram(resources, exprGlslBody);
    // Force a re-render after compilation
    untrack(() => loop?.restart());
  });

  // Render trigger: restart RAF loop on any visual state change
  $effect(() => {
    void [
      exprGlslBody, expr, omega1, omega2, tau, mode, halo, showHalo, viewMode, terms,
      showGrid, showLattice, showCell, showSpecialPoints, showOmega, zeros,
      resourceVersion, sizeVersion, zoom, pan.x, pan.y, g2, g3, hoverAnchor,
    ];
    untrack(() => loop?.restart());
  });

  // ── Exported methods ──────────────────────────────────────────────────────

  export function setCamera(newZoom: number, newPan: Vec2) {
    zoom = newZoom;
    pan = { ...newPan };
  }

  export function resetCamera() {
    zoom = 1.6;
    pan = { x: 0.8, y: 0.7 };
  }

  export function getCamera() {
    return { zoom, pan: { ...pan } };
  }
</script>

<div
  bind:this={container}
  class="viewport"
  role="application"
  aria-label="Weierstrass visualiser"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onpointerleave={handlePointerLeave}
  onwheel={handleWheel}
  ondblclick={handleDoubleClick}
>
  <canvas bind:this={glCanvas}      class="gl-canvas"></canvas>
  <canvas bind:this={overlayCanvas} class="overlay-canvas"></canvas>
  {#if showOverlay}
    <div class="hint">
      <span>drag ω₁ or ω₂ · pan background</span>
      <span>scroll to zoom · double-click to reset</span>
    </div>
  {/if}
</div>

<style>
  .viewport {
    position: relative;
    width: 100%;
    height: 100%;
    background: black;
    overflow: hidden;
  }
  .gl-canvas, .overlay-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .hint {
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: rgba(255, 200, 150, 0.45);
    background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
    pointer-events: none;
  }
</style>
