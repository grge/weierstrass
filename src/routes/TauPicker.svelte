<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { Vec2 } from "$lib/types";
  import type { RenderMode } from "$lib/types";
  import { basisFromTau, tauFromBasis } from "$lib/lattice";
  import {
    createModularResources, destroyModularResources, renderModular,
    type ModularFunc,
  } from "$lib/modular_gl";

  let {
    omega1 = $bindable(),
    omega2 = $bindable(),
    colorMode = 2,
    showGrid = false,
    tauTileSize = 400,
    tauTerms = 20,
  }: { omega1: Vec2; omega2: Vec2; colorMode?: RenderMode; showGrid?: boolean; tauTileSize?: number; tauTerms?: number } = $props();

  const MIN_TAU_IM = 0.05;

  function normalizeTau(tau: Vec2): Vec2 {
    return { x: tau.x, y: Math.max(tau.y, MIN_TAU_IM) };
  }

  function getScale(o1: Vec2): number {
    return Math.sqrt(o1.x * o1.x + o1.y * o1.y);
  }

  function applyTau(tau: Vec2) {
    const t = normalizeTau(tau);
    const angle = Math.atan2(omega1.y, omega1.x);
    const scale = getScale(omega1);
    const basis = basisFromTau(t, scale, angle);
    omega1 = basis.omega1;
    omega2 = basis.omega2;
  }

  function applyScale(newScale: number) {
    const s = getScale(omega1);
    if (s < 1e-12) return;
    const f = newScale / s;
    omega1 = { x: omega1.x * f, y: omega1.y * f };
    omega2 = { x: omega2.x * f, y: omega2.y * f };
  }

  function resetScale() { applyScale(1.0); }
  function setHex()    { applyTau({ x: 0.5, y: Math.sqrt(3) / 2 }); }
  function setSquare() { applyTau({ x: 0, y: 1 }); }

  // ── Viewport geometry ─────────────────────────────────────────────
  // Visible τ region: Re ∈ [-RANGE, RANGE], Im ∈ [0, RANGE]
  const RANGE = 2.5;

  // CSS pixel dimensions of the canvas container — updated by ResizeObserver
  let cssW = $state(200);
  let cssH = $state(150);

  // Map world coords → device pixels (canvas buffer space)
  function worldToCanvas(wx: number, wy: number, w: number, h: number): [number, number] {
    return [
      (wx / RANGE + 1) * 0.5 * w,
      (1 - wy / RANGE) * h,
    ];
  }

  // Map CSS pointer coords → world coords
  function canvasToWorld(cx: number, cy: number): Vec2 {
    return {
      x: (cx / cssW * 2 - 1) * RANGE,
      y: (1 - cy / cssH) * RANGE,
    };
  }

  // ── Modular background ────────────────────────────────────────────
  let modularFunc: ModularFunc | "none" = $state("none");

  let glW = $derived(Math.round(tauTileSize));
  let glH = $derived(Math.round(tauTileSize * 3 / 4));  // 4:3 aspect

  let glCanvas: HTMLCanvasElement;
  let glResources: ReturnType<typeof createModularResources> | null = null;

  onMount(() => {
    const gl = glCanvas.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;
    try {
      glResources = createModularResources(gl);
    } catch (e) {
      console.error("Modular GL init failed:", e);
      return;
    }
    return () => {
      if (glResources) { destroyModularResources(glResources); glResources = null; }
    };
  });

  $effect(() => {
    if (modularFunc === "none" || !glResources || !glCanvas) return;
    if (glCanvas.width !== glW || glCanvas.height !== glH) {
      glCanvas.width = glW;
      glCanvas.height = glH;
    }
    renderModular(
      glResources,
      modularFunc,
      colorMode,
      -RANGE, RANGE,
      0, RANGE,
      glW, glH,
      tauTerms,
    );
  });

  // ── Interaction ───────────────────────────────────────────────────
  let container: HTMLDivElement;
  let overlay: HTMLCanvasElement;
  let dragging = $state(false);
  let hovering = $state(false);

  onMount(() => {
    // Track actual rendered CSS size so overlay draws at correct resolution
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (!e) return;
      untrack(() => {
        cssW = e.contentRect.width;
        cssH = e.contentRect.height;
      });
    });
    ro.observe(container);
    return () => ro.disconnect();
  });

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moveTo(e);
  }
  function onPointerMove(e: PointerEvent) {
    if (dragging) {
      moveTo(e);
    } else {
      hovering = isOverHandle(e);
    }
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }
  function onPointerEnter() { hovering = false; }
  function onPointerLeave() { hovering = false; }

  function isOverHandle(e: PointerEvent): boolean {
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    const [tx, ty] = worldToCanvas(tau.x, tau.y, w, h);
    const mx = cx * dpr;
    const my = cy * dpr;
    return Math.hypot(mx - tx, my - ty) <= 12 * dpr;
  }

  function moveTo(e: PointerEvent) {
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    applyTau(canvasToWorld(cx, cy));
  }

  // ── Overlay draw (2D) ─────────────────────────────────────────────
  $effect(() => {
    void [omega1, omega2, hovering, dragging, showGrid, modularFunc, cssW, cssH];
    if (!overlay) return;

    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }

    const hasBackground = modularFunc !== "none";
    const ctx = overlay.getContext("2d", { alpha: true })!;
    ctx.clearRect(0, 0, w, h);

    if (!hasBackground) {
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(0, 0, w, h);
    }

    // ── a) complex grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = dpr;
      for (let v = 0; v <= 2; v++) {
        const [,y0] = worldToCanvas(-RANGE, v, w, h);
        ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
      }
      for (let u = -2; u <= 2; u++) {
        const [x0] = worldToCanvas(u, 0, w, h);
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, h); ctx.stroke();
      }
    }

    // ── b) axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = dpr;
    const [ax] = worldToCanvas(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.stroke();

    // ── c) vector line origin → τ
    const [ox, oy] = worldToCanvas(0, 0, w, h);
    const [tx, ty] = worldToCanvas(tau.x, tau.y, w, h);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // origin dot
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath(); ctx.arc(ox, oy, 2.5 * dpr, 0, Math.PI * 2); ctx.fill();

    // ── d) τ handle
    const active = hovering || dragging;
    const r = (active ? 12 : 10.5) * dpr;
    if (active) {
      ctx.fillStyle = "rgba(255, 170, 70, 0.25)";
      ctx.beginPath(); ctx.arc(tx, ty, r * 1.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = active ? "rgba(255, 165, 60, 1.0)" : "rgba(255, 140, 40, 1.0)";
    ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = (active ? 1.9 : 1.5) * dpr;
    ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // τ label inside handle
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.font = `600 ${Math.round(11 * dpr)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("τ", tx, ty);
  });

  // ── Scale ─────────────────────────────────────────────────────────
  const tau = $derived(tauFromBasis(omega1, omega2));
  const tauLabel = $derived(
    `τ = ${tau.x.toFixed(3)} + ${tau.y.toFixed(3)}i`
  );
  let scaleValue = $derived(getScale(omega1));
  let logScale   = $derived(Math.log2(scaleValue));

  function onScaleSlider(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    applyScale(Math.pow(2, v));
  }
</script>

<div class="tau-section">
  <div class="canvas-stack" bind:this={container}>
    <!-- GL layer: modular background -->
    <canvas
      bind:this={glCanvas}
      width={400}
      height={300}
      class="tau-canvas gl-layer"
      class:hidden={modularFunc === "none"}
    ></canvas>
    <!-- 2D layer: grid, axes, τ handle — also captures pointer events -->
    <canvas
      bind:this={overlay}
      width={200}
      height={150}
      class="tau-canvas overlay-layer"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onpointerenter={onPointerEnter}
      onpointerleave={onPointerLeave}
    ></canvas>
  </div>
  <div class="tau-label">{tauLabel}</div>

  <div class="tau-buttons">
    <button onclick={setSquare}>Square</button>
    <button onclick={setHex}>Hexagonal</button>
  </div>
  <div class="tau-buttons">
    <button onclick={resetScale}>Scale = 1</button>
  </div>

  <label class="inline-label">
    <span>Background</span>
    <select bind:value={modularFunc}>
      <option value="none">None</option>
      <option value="j">j(τ)</option>
      <option value="delta">Δ(τ)</option>
      <option value="e4">E4(τ)</option>
      <option value="e6">E6(τ)</option>
    </select>
  </label>

  <label>
    <div class="slider-header">
      <span>Scale (|&#969;&#8321;|)</span>
      <span class="val">{scaleValue.toFixed(3)}</span>
    </div>
    <input
      type="range"
      min="-3" max="3" step="0.01"
      value={logScale}
      oninput={onScaleSlider}
    />
  </label>
</div>

<style>
  .tau-section {
    padding: 0.5rem 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .canvas-stack {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    border: 1px solid rgba(255,150,60,0.2);
  }

  .tau-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .gl-layer   { background: #1a1210; }
  .overlay-layer { cursor: crosshair; }

  .hidden { visibility: hidden; }

  .tau-buttons {
    display: flex;
    gap: 6px;
  }

  button {
    flex: 1;
    background: rgba(255, 150, 60, 0.08);
    border: 1px solid rgba(255, 150, 60, 0.25);
    color: rgba(255, 200, 150, 0.75);
    padding: 4px 0;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    font-family: inherit;
  }
  button:hover {
    background: rgba(255, 150, 60, 0.18);
    color: rgba(255, 220, 180, 1);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.72rem;
    color: rgba(255, 200, 150, 0.75);
  }
  .inline-label {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .slider-header {
    display: flex;
    justify-content: space-between;
  }
  .val { color: rgba(255, 220, 180, 1); }
  select {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.2);
    color: rgba(255, 220, 180, 0.9);
    padding: 0.2rem 0.4rem;
    font-size: 0.72rem;
    font-family: inherit;
  }
  input[type=range] {
    width: 100%;
    accent-color: rgba(255, 150, 60, 0.8);
    cursor: pointer;
  }
  .tau-label {
    font-size: 0.72rem;
    font-family: monospace;
    color: rgba(255, 200, 150, 0.7);
    text-align: right;
  }
</style>
