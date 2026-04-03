<script lang="ts">
  import type { Vec2 } from "$lib/types";
  import { basisFromTau, tauFromBasis } from "$lib/lattice";

  let {
    omega1 = $bindable(),
    omega2 = $bindable(),
  }: { omega1: Vec2; omega2: Vec2 } = $props();

  const MIN_TAU_IM = 0.05;

  function normalizeTau(tau: Vec2): Vec2 {
    return { x: tau.x, y: Math.max(tau.y, MIN_TAU_IM) };
  }

  // Derived: scale = |omega1|
  function getScale(o1: Vec2): number {
    return Math.sqrt(o1.x * o1.x + o1.y * o1.y);
  }

  // Apply a new tau, preserving omega1 exactly
  function applyTau(tau: Vec2) {
    const t = normalizeTau(tau);
    const angle = Math.atan2(omega1.y, omega1.x);
    const scale = getScale(omega1);
    const basis = basisFromTau(t, scale, angle);
    omega1 = basis.omega1;
    omega2 = basis.omega2;
  }

  // Apply a new scale factor, preserving tau (scale both equally)
  function applyScale(newScale: number) {
    const s = getScale(omega1);
    if (s < 1e-12) return;
    const f = newScale / s;
    omega1 = { x: omega1.x * f, y: omega1.y * f };
    omega2 = { x: omega2.x * f, y: omega2.y * f };
  }

  // Reset scale to 1.0, preserving tau and rotation
  function resetScale() {
    applyScale(1.0);
  }

  // Hexagonal lattice: tau = e^(iπ/3) = 0.5 + i√3/2
  function setHex() {
    applyTau({ x: 0.5, y: Math.sqrt(3) / 2 });
  }

  // Square lattice: tau = i
  function setSquare() {
    applyTau({ x: 0, y: 1 });
  }

  // ── Canvas picker ──────────────────────────────────────────────────
  let canvas: HTMLCanvasElement;
  const SIZE = 200;
  const RANGE = 2.5; // world units shown on each axis half

  function worldToCanvas(wx: number, wy: number): [number, number] {
    return [
      (wx / RANGE + 1) * 0.5 * SIZE,
      (1 - wy / RANGE) * 0.5 * SIZE,   // y flipped
    ];
  }

  function canvasToWorld(cx: number, cy: number): Vec2 {
    return {
      x: (cx / SIZE * 2 - 1) * RANGE,
      y: (1 - cy / SIZE * 2) * RANGE,
    };
  }

  let dragging = false;

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

  function moveTo(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (SIZE / rect.width);
    const cy = (e.clientY - rect.top)  * (SIZE / rect.height);
    applyTau(canvasToWorld(cx, cy));
  }

  // ── Draw ──────────────────────────────────────────────────────────
  $effect(() => {
    const tau = tauFromBasis(omega1, omega2);
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Background
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,180,100,0.12)';
    ctx.lineWidth = 0.5;
    for (let v = -2; v <= 2; v++) {
      const [x0] = worldToCanvas(v, -RANGE);
      const [x1] = worldToCanvas(v,  RANGE);
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, SIZE); ctx.stroke();
      const [,y0] = worldToCanvas(-RANGE, v);
      const [,y1] = worldToCanvas( RANGE, v);
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(SIZE, y1); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,180,100,0.35)';
    ctx.lineWidth = 1;
    const [ax] = worldToCanvas(0, 0);
    const [,ay] = worldToCanvas(0, 0);
    ctx.beginPath(); ctx.moveTo(ax, 0);    ctx.lineTo(ax, SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ay);    ctx.lineTo(SIZE, ay); ctx.stroke();

    // Reference point at (1, 0) — where omega1 direction points
    const [rx, ry] = worldToCanvas(1, 0);
    ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,180,100,0.5)';
    ctx.fill();

    // Line from origin to tau
    const [ox, oy] = worldToCanvas(0, 0);
    const [tx, ty] = worldToCanvas(tau.x, tau.y);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty);
    ctx.strokeStyle = 'rgba(255,150,60,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tau dot
    ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,150,60,1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    const tauLabel = `${tau.x.toFixed(2)} + ${tau.y.toFixed(2)}i`;
    ctx.fillStyle = 'rgba(255,220,180,0.7)';
    ctx.font = '10px monospace';
    ctx.fillText(`τ = ${tauLabel}`, 4, SIZE - 4);
  });

  // Scale state — reactive derived
  let scaleValue = $derived(getScale(omega1));
  let logScale = $derived(Math.log2(scaleValue));

  function onScaleSlider(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    applyScale(Math.pow(2, v));
  }
</script>

<div class="tau-section">
  <canvas
    bind:this={canvas}
    width={SIZE}
    height={SIZE}
    class="tau-canvas"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  ></canvas>

  <div class="tau-buttons">
    <button onclick={setSquare}>Square</button>
    <button onclick={setHex}>Hexagonal</button>
  </div>
  <div class="tau-buttons">
    <button onclick={resetScale}>Scale = 1</button>
  </div>

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

  .tau-canvas {
    width: 100%;
    aspect-ratio: 1;
    cursor: crosshair;
    display: block;
    border: 1px solid rgba(255,150,60,0.2);
  }

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
  .slider-header {
    display: flex;
    justify-content: space-between;
  }
  .val { color: rgba(255, 220, 180, 1); }
  input[type=range] {
    width: 100%;
    accent-color: rgba(255, 150, 60, 0.8);
    cursor: pointer;
  }
</style>
