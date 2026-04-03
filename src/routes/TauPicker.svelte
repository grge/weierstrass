<script lang="ts">
  import { onMount } from "svelte";
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

  // ── Viewport ──────────────────────────────────────────────────────
  const W = 200;
  const H = 150;
  // Visible τ region: Re ∈ [-RANGE, RANGE], Im ∈ [0, RANGE]
  const RANGE = 2.5;

  function worldToCanvas(wx: number, wy: number): [number, number] {
    return [
      (wx / RANGE + 1) * 0.5 * W,
      (1 - wy / RANGE) * H,
    ];
  }

  function canvasToWorld(cx: number, cy: number): Vec2 {
    return {
      x: (cx / W * 2 - 1) * RANGE,
      y: (1 - cy / H) * RANGE,
    };
  }

  // ── Modular background ────────────────────────────────────────────
  let modularFunc: ModularFunc | "none" = $state("none");

  // GL canvas pixel dimensions — CSS size is fixed, this controls render resolution
  // Scale CSS canvas size (200×150) by tauTileSize/W to get GL pixel dimensions
  let glW = $derived(Math.round(tauTileSize));
  let glH = $derived(Math.round(tauTileSize * H / W));

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
    // Set canvas pixel dimensions before rendering to guarantee viewport consistency
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
  let overlay: HTMLCanvasElement;
  let dragging = false;
  let hovering = false;

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moveTo(e);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    moveTo(e);
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }
  function onPointerEnter() { hovering = true; }
  function onPointerLeave() { hovering = false; }

  function moveTo(e: PointerEvent) {
    const rect = overlay.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (W / rect.width);
    const cy = (e.clientY - rect.top)  * (H / rect.height);
    applyTau(canvasToWorld(cx, cy));
  }

  // ── Overlay draw (2D) ─────────────────────────────────────────────
  $effect(() => {
    void [omega1, omega2, hovering, dragging, showGrid, modularFunc]; // reactive dependencies
    if (!overlay) return;
    const hasBackground = modularFunc !== "none";
    const ctx = overlay.getContext("2d", { alpha: true })!;
    ctx.clearRect(0, 0, W, H);

    if (!hasBackground) {
      ctx.fillStyle = "#1a1210";
      ctx.fillRect(0, 0, W, H);
    }

    // ── a) complex grid — white, matching main viewport style
    if (showGrid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 0.5;
      for (let v = 0; v <= 2; v++) {
        const [,y0] = worldToCanvas(-RANGE, v);
        ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
      }
      for (let u = -2; u <= 2; u++) {
        const [x0] = worldToCanvas(u, 0);
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke();
      }
    }

    // ── b) axes — white, stronger than grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1;
    const [ax] = worldToCanvas(0, 0);
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.stroke();

    // ── c) vector line from origin to τ — white, matching ω vectors in viewport
    const [ox, oy] = worldToCanvas(0, 0);
    const [tx, ty] = worldToCanvas(tau.x, tau.y);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // origin dot
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();

    // ── d) τ handle — styled to match ω₁/ω₂ handles in viewport
    const active = hovering || dragging;
    const r = active ? 12 : 10.5;
    if (active) {
      ctx.fillStyle = "rgba(255, 170, 70, 0.25)";
      ctx.beginPath(); ctx.arc(tx, ty, r * 1.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = active ? "rgba(255, 165, 60, 1.0)" : "rgba(255, 140, 40, 1.0)";
    ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = active ? 1.9 : 1.5;
    ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // τ label inside handle
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.font = "600 11px system-ui, sans-serif";
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
  <div class="canvas-stack">
    <!-- GL layer: modular background -->
    <canvas
      bind:this={glCanvas}
      width={W}
      height={H}
      class="tau-canvas gl-layer"
      class:hidden={modularFunc === "none"}
    ></canvas>
    <!-- 2D layer: grid, axes, τ dot, labels — also captures pointer events -->
    <canvas
      bind:this={overlay}
      width={W}
      height={H}
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
