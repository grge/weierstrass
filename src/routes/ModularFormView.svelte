<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { basisFromTau, tauFromBasis } from "$lib/lattice";
  import { getScale } from "$lib/lattice-utils";
  import { drawGridWithTicksXY } from "$lib/grid-renderer";
  import { createLerpLoop } from "$lib/lerp-loop";
  import type { LerpLoop } from "$lib/lerp-loop";
  import { observeSize } from "$lib/canvas-size";
  import { drawHandle, drawAxesXY, drawVectorArrow, drawOriginDot } from "$lib/overlay-draw";
  import {
    createModularResources, destroyModularResources, renderModular,
    type ModularFunc,
  } from "$lib/modular_gl";
  import type { Vec2, RenderMode } from "$lib/types";

  // ── Props ──────────────────────────────────────────────────────────────────

  let {
    omega1 = $bindable(),
    omega2 = $bindable(),
    colorMode = 2,
    showGrid = false,
    tauTileSize = $bindable(400),
    tauTerms = $bindable(20),
    fillViewport = false,
    modularForm = $bindable("j"),
  }: {
    omega1: Vec2; omega2: Vec2; colorMode?: RenderMode;
    showGrid?: boolean; tauTileSize: number; tauTerms: number;
    fillViewport?: boolean;
    modularForm?: "j" | "delta" | "e4" | "e6";
  } = $props();

  // ── DOM refs ───────────────────────────────────────────────────────────────

  let container: HTMLDivElement;
  let overlay: HTMLCanvasElement;
  let glCanvas: HTMLCanvasElement;
  let glResources: ReturnType<typeof createModularResources> | null = null;

  // ── Derived state ──────────────────────────────────────────────────────────

  const tau = $derived(tauFromBasis(omega1, omega2));
  let glW = $derived(Math.round(tauTileSize));
  let glH = $derived(Math.round(tauTileSize * 3 / 4));  // 4:3 aspect

  // ── Camera / view state ────────────────────────────────────────────────────
  // Camera targets: panX = centre of visible Re(τ) range, range = half-width.
  // Bottom is always fixed at Im(τ) = 0. Height scales with range × aspect ratio.

  const DEFAULT_RANGE = 2.5;
  let panX = $state(0.0);
  let range = $state(DEFAULT_RANGE);

  // Smoothed camera state (lerped toward targets each RAF frame)
  let camPanX = 0.0;
  let camRange = DEFAULT_RANGE;
  let loop: LerpLoop | null = null;

  const LERP_T = 0.14;
  const CAM_EPS = 1e-5;

  // CSS pixel dimensions of the canvas container — updated by ResizeObserver
  let cssW = $state(200);
  let cssH = $state(150);

  // ── Coordinate transforms ──────────────────────────────────────────────────

  function getBounds() {
    const xMin = camPanX - camRange;
    const xMax = camPanX + camRange;
    return { xMin, xMax, yMin: 0, yMax: camRange * (cssH / cssW) };
  }

  // Map world coords → device pixels using current smoothed bounds
  function worldToCanvas(wx: number, wy: number, w: number, h: number): [number, number] {
    const { xMin, xMax, yMin, yMax } = getBounds();
    return [
      ((wx - xMin) / (xMax - xMin)) * w,
      (1 - (wy - yMin) / (yMax - yMin)) * h,
    ];
  }

  // Map CSS pointer coords → world coords using current target bounds
  function canvasToWorld(cx: number, cy: number): Vec2 {
    const xMin = panX - range;
    const xMax = panX + range;
    const yMax = range * (cssH / cssW);
    return {
      x: xMin + (cx / cssW) * (xMax - xMin),
      y: (1 - cy / cssH) * yMax,
    };
  }

  // ── Lattice helpers ────────────────────────────────────────────────────────

  const MIN_TAU_IM = 0.05;

  function normalizeTau(t: Vec2): Vec2 {
    return { x: t.x, y: Math.max(t.y, MIN_TAU_IM) };
  }



  function applyTau(t: Vec2) {
    const normalized = normalizeTau(t);
    const angle = Math.atan2(omega1.y, omega1.x);
    const scale = getScale(omega1);
    const basis = basisFromTau(normalized, scale, angle);
    omega1 = basis.omega1;
    omega2 = basis.omega2;
  }

  // ── Animation state ────────────────────────────────────────────────────────

  let animating = $state(false);
  let animStart = 0;
  const animDuration = 400; // ms
  let animStartOmega1: Vec2 = { x: 0, y: 0 };
  let animStartOmega2: Vec2 = { x: 0, y: 0 };
  let animTargetOmega1: Vec2 = { x: 0, y: 0 };
  let animTargetOmega2: Vec2 = { x: 0, y: 0 };

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function startAnimation(target1: Vec2, target2: Vec2) {
    if (animating) return;
    animStartOmega1 = { ...omega1 };
    animStartOmega2 = { ...omega2 };
    animTargetOmega1 = target1;
    animTargetOmega2 = target2;
    animStart = performance.now();
    animating = true;
  }

  $effect(() => {
    if (!animating) return;
    let rafId: number;
    const handleFrame = (now: number) => {
      const elapsed = now - animStart;
      const progress = Math.min(elapsed / animDuration, 1);
      const eased = easeInOutCubic(progress);
      omega1 = {
        x: animStartOmega1.x + (animTargetOmega1.x - animStartOmega1.x) * eased,
        y: animStartOmega1.y + (animTargetOmega1.y - animStartOmega1.y) * eased,
      };
      omega2 = {
        x: animStartOmega2.x + (animTargetOmega2.x - animStartOmega2.x) * eased,
        y: animStartOmega2.y + (animTargetOmega2.y - animStartOmega2.y) * eased,
      };
      if (progress < 1) {
        rafId = requestAnimationFrame(handleFrame);
      } else {
        omega1 = animTargetOmega1;
        omega2 = animTargetOmega2;
        animating = false;
      }
    };
    rafId = requestAnimationFrame(handleFrame);
    return () => cancelAnimationFrame(rafId);
  });

  // ── Exported methods ──────────────────────────────────────────────────────

  export function setCamera(newPanX: number, newRange: number) {
    panX = newPanX;
    range = Math.max(MIN_RANGE, Math.min(MAX_RANGE, newRange));
  }

  export function resetCamera() {
    panX = 0;
    range = DEFAULT_RANGE;
  }

  export function getCamera() {
    return { panX, range };
  }

  // ── Exported actions ───────────────────────────────────────────────────────

  export function setSquare() {
    const basis = basisFromTau({ x: 0, y: 1 }, getScale(omega1), Math.atan2(omega1.y, omega1.x));
    startAnimation(basis.omega1, basis.omega2);
  }

  export function setHex() {
    const basis = basisFromTau({ x: 0.5, y: Math.sqrt(3) / 2 }, getScale(omega1), Math.atan2(omega1.y, omega1.x));
    startAnimation(basis.omega1, basis.omega2);
  }

  export function applyT() {
    const t = tauFromBasis(omega1, omega2);
    const basis = basisFromTau({ x: t.x + 1, y: t.y }, getScale(omega1), Math.atan2(omega1.y, omega1.x));
    startAnimation(basis.omega1, basis.omega2);
  }

  export function applyS() {
    const t = tauFromBasis(omega1, omega2);
    const norm2 = t.x * t.x + t.y * t.y;
    if (norm2 < 1e-12) return;
    const newTau = normalizeTau({ x: -t.x / norm2, y: t.y / norm2 });
    const basis = basisFromTau(newTau, getScale(omega1), Math.atan2(omega1.y, omega1.x));
    startAnimation(basis.omega1, basis.omega2);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  $effect(() => {
    void [omega1, omega2, modularForm, colorMode, tauTerms, glW, glH,
          showGrid, cssW, cssH, panX, range, hovering];
    untrack(() => loop?.restart());
  });

  function drawFrame() {
    if (!glResources || !glCanvas || !overlay) return;
    const { xMin, xMax, yMin, yMax } = getBounds();

    if (glCanvas.width !== glW || glCanvas.height !== glH) {
      glCanvas.width = glW;
      glCanvas.height = glH;
    }
    renderModular(glResources, modularForm, colorMode, xMin, xMax, yMin, yMax, glW, glH, tauTerms);

    drawOverlay();
  }

  function drawOverlay() {
    if (!overlay) return;
    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    const { xMin, xMax, yMin, yMax } = getBounds();

    const ctx = overlay.getContext("2d", { alpha: true })!;
    ctx.clearRect(0, 0, w, h);

    // ── a) Grid
    drawGridWithTicksXY(
      ctx,
      { min: xMin, max: xMax },
      { min: yMin, max: yMax },
      (worldX: number) => worldToCanvas(worldX, 0, w, h)[0],
      (worldY: number) => worldToCanvas(0, worldY, w, h)[1],
      w, h,
      {
        showGrid,
        showTicks: true,
        showLabels: true,
        tickSize: 4 * dpr,
        labelOffset: 4 * dpr,
        labelFont: `${Math.round(9 * dpr)}px monospace`,
        edgeClip: 6,
      },
    );

    // ── b) Axes
    const [ox, oy] = worldToCanvas(0, 0, w, h);
    drawAxesXY(ctx, ox, oy, w, h, dpr);

    // ── c) vector origin → τ
    const [tx, ty] = worldToCanvas(tau.x, tau.y, w, h);
    drawVectorArrow(ctx, ox, oy, tx, ty, dpr);
    drawOriginDot(ctx, ox, oy, dpr);

    // ── d) τ handle
    drawHandle(ctx, tx, ty, "τ", hovering || dragState !== null, dpr);
  }

  // ── Interaction handlers ───────────────────────────────────────────────────

  let hovering = $state(false);
  let dragState: { startClientX: number; startPanX: number } | null = null;

  const ZOOM_SPEED = 0.0012;
  const MIN_RANGE = 0.1;
  const MAX_RANGE = 20;

  function isOverHandle(e: PointerEvent): boolean {
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    const [tx, ty] = worldToCanvas(tau.x, tau.y, w, h);
    return Math.hypot(cx * dpr - tx, cy * dpr - ty) <= 12 * dpr;
  }

  function moveTo(e: PointerEvent) {
    const rect = overlay.getBoundingClientRect();
    applyTau(canvasToWorld(e.clientX - rect.left, e.clientY - rect.top));
  }

  function onPointerDown(e: PointerEvent) {
    if (isOverHandle(e)) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      moveTo(e);
      return;
    }
    dragState = { startClientX: e.clientX, startPanX: panX };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (dragState) {
      const dxPx = e.clientX - dragState.startClientX;
      panX = dragState.startPanX - dxPx * (2 * range) / cssW;
      camPanX = panX;
      hovering = false;
      return;
    }
    if (e.buttons === 1) {
      hovering = true;
      moveTo(e);
      return;
    }
    hovering = isOverHandle(e);
  }

  function onPointerUp(e: PointerEvent) {
    dragState = null;
    hovering = isOverHandle(e);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function onPointerEnter() { hovering = false; }
  function onPointerLeave() { hovering = false; }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cursorWorldX = (panX - range) + (cx / cssW) * (2 * range);
    const newRange = Math.max(MIN_RANGE, Math.min(MAX_RANGE, range * Math.exp(e.deltaY * ZOOM_SPEED)));
    panX = cursorWorldX + newRange * (1 - 2 * cx / cssW);
    range = newRange;
  }

  function onDblClick() {
    panX = 0;
    range = DEFAULT_RANGE;
  }

  // ── Mount / lifecycle ──────────────────────────────────────────────────────

  onMount(() => {
    const gl = glCanvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) return;
    try {
      glResources = createModularResources(gl);
    } catch (e) {
      console.error("Modular GL init failed:", e);
      return;
    }

    const stopObserving = observeSize(container, (w, h) => {
      untrack(() => { cssW = w; cssH = h; });
    });

    loop = createLerpLoop({
      onFrame() {
        camPanX += (panX  - camPanX) * LERP_T;
        camRange += (range - camRange) * LERP_T;
        drawFrame();
      },
      isSettled() {
        return Math.abs(camPanX  - panX)  < CAM_EPS &&
               Math.abs(camRange - range) < CAM_EPS;
      },
      onSettle() {
        camPanX = panX; camRange = range;
        drawFrame();
      },
    });
    loop.restart();

    return () => {
      stopObserving();
      loop?.destroy();
      if (glResources) { destroyModularResources(glResources); glResources = null; }
    };
  });
</script>

<div class="view-section" class:fill-viewport={fillViewport}>
  <div class="canvas-stack" bind:this={container}>
    <!-- GL layer: modular background -->
    <canvas
      bind:this={glCanvas}
      width={400}
      height={300}
      class="main-canvas gl-layer"
    ></canvas>
    <!-- 2D layer: grid, axes, τ handle — also captures pointer events -->
    <canvas
      bind:this={overlay}
      width={200}
      height={150}
      class="main-canvas overlay-layer"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onpointerenter={onPointerEnter}
      onpointerleave={onPointerLeave}
      onwheel={onWheel}
      ondblclick={onDblClick}
    ></canvas>
  </div>

</div>

<style>
  .view-section {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .view-section.fill-viewport {
    padding: 0;
    width: 100%;
    height: 100%;
  }

  .canvas-stack {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border: 1px solid rgba(255, 150, 60, 0.15);
    border-radius: 0.3rem;
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
  }

  .gl-layer   { background: #1a1210; }
  .overlay-layer { cursor: grab; }
</style>
