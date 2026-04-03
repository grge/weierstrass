<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { createResources, destroyResources, render } from "$lib/gl";
  import { worldToScreen, screenToWorld, clamp, findWeierstrassZeros } from "$lib/math";
  import { toLatticeCoords } from "$lib/lattice";
  import type { Vec2, DragState, GLResources, RenderMode, ViewMode } from "$lib/types";

  let {
    omega1 = $bindable({ x: 1, y: 0 }),
    omega2 = $bindable({ x: 0.25, y: 1.2 }),
    zoom   = $bindable(1.6),
    pan    = $bindable({ x: 0.8, y: 0.7 }),
    tau,
    mode,
    brightness,
    contrast,
    halo,
    poleThreshold,
    poleSoftness,
    poleStrength,
    zeroThreshold,
    zeroSoftness,
    zeroStrength,
    tileSize,
    terms = 5,
    showGrid,
    showLattice,
    showCell,
    showSpecialPoints,
    showHalo,
    showOmega,
    viewMode = "plane",
  }: {
    omega1?: Vec2; omega2?: Vec2; zoom?: number; pan?: Vec2;
    tau: Vec2; mode: RenderMode; brightness: number; contrast: number;
    halo: number; poleThreshold: number; poleSoftness: number; poleStrength: number;
    zeroThreshold: number; zeroSoftness: number; zeroStrength: number;
    tileSize: number; terms?: number;
    showGrid: boolean; showLattice: boolean; showCell: boolean;
    showSpecialPoints: boolean; showHalo: boolean; showOmega: boolean; viewMode?: ViewMode;
  } = $props();

  let container: HTMLDivElement;
  let glCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;
  let resources: GLResources | null = null;
  let resourceVersion = $state(0);
  let sizeVersion = $state(0);  // bumped on window resize to trigger re-render
  let drag: DragState | null = null;
  let hoverAnchor: "omega1" | "omega2" | null = $state(null);

  let prevZerosRef: Vec2[] = [];
  let zeros: Vec2[] = $state([]);

  // ── GL lifecycle ──────────────────────────────────────────────────────────

  $effect(() => {
    const ts = tileSize;
    if (!glCanvas) return;
    const gl = glCanvas.getContext("webgl", {
      antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
    if (!gl) return;
    if (resources) destroyResources(resources);
    try {
      resources = createResources(gl, ts);
      untrack(() => { resourceVersion++; });
    } catch {
      resources = null;
    }
    return () => { if (resources) { destroyResources(resources); resources = null; } };
  });

  $effect(() => {
    const nextZeros = findWeierstrassZeros(omega1, omega2, prevZerosRef, terms);
    prevZerosRef = nextZeros;
    zeros = nextZeros;
  });

  $effect(() => {
    void resourceVersion;
    void sizeVersion;
    if (!resources || !glCanvas || !overlayCanvas) return;
    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const w = Math.max(1, Math.floor(container.clientWidth  * dpr));
    const h = Math.max(1, Math.floor(container.clientHeight * dpr));
    if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h; }
    if (overlayCanvas.width !== w || overlayCanvas.height !== h) { overlayCanvas.width = w; overlayCanvas.height = h; }

    render(resources, {
      omega1, omega2, tau, zoom, pan, mode, brightness, contrast,
      halo: showHalo ? halo : 0,
      poleThreshold, poleSoftness, poleStrength,
      zeroThreshold, zeroSoftness, zeroStrength,
      viewMode, terms,
      width: w, height: h,
    });

    drawOverlay(overlayCanvas, w, h, dpr, zeros);

  });

  // ── overlay drawing ───────────────────────────────────────────────────────

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
      screenToWorld(0, 0, w, h, pan.x, pan.y, zoom),
      screenToWorld(w, 0, w, h, pan.x, pan.y, zoom),
      screenToWorld(0, h, w, h, pan.x, pan.y, zoom),
      screenToWorld(w, h, w, h, pan.x, pan.y, zoom),
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
    return worldToScreen(x, y, w, h, pan.x, pan.y, zoom);
  }

  function drawOverlay(canvas: HTMLCanvasElement, w: number, h: number, dpr: number, zeros: Vec2[]) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // ── a) complex grid ──────────────────────────────────────────────────────
    if (showGrid) {
      const tl = screenToWorld(0, 0, w, h, pan.x, pan.y, zoom);
      const br = screenToWorld(w, h, w, h, pan.x, pan.y, zoom);
      const xMin = Math.ceil(Math.min(tl.x, br.x));
      const xMax = Math.floor(Math.max(tl.x, br.x));
      const yMin = Math.ceil(Math.min(tl.y, br.y));
      const yMax = Math.floor(Math.max(tl.y, br.y));
      const MAX_LINES = 40;
      ctx.strokeStyle = "rgba(160, 210, 255, 0.3)";
      ctx.lineWidth = dpr;
      if (xMax - xMin <= MAX_LINES) {
        for (let x = xMin; x <= xMax; x++) {
          const s0 = ws(x, tl.y, w, h), s1 = ws(x, br.y, w, h);
          ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
        }
      }
      if (yMax - yMin <= MAX_LINES) {
        for (let y = yMin; y <= yMax; y++) {
          const s0 = ws(tl.x, y, w, h), s1 = ws(br.x, y, w, h);
          ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
        }
      }
      // axis highlight
      ctx.strokeStyle = "rgba(160, 210, 255, 0.55)";
      ctx.lineWidth = 1.5 * dpr;
      const ax = ws(0, tl.y, w, h), bx = ws(0, br.y, w, h);
      ctx.beginPath(); ctx.moveTo(ax.x, ax.y); ctx.lineTo(bx.x, bx.y); ctx.stroke();
      const ay = ws(tl.x, 0, w, h), by2 = ws(br.x, 0, w, h);
      ctx.beginPath(); ctx.moveTo(ay.x, ay.y); ctx.lineTo(by2.x, by2.y); ctx.stroke();
    }

    // ── b) cell lattice grid ─────────────────────────────────────────────────
    if (showLattice) {
      const { mMin, mMax, nMin, nMax } = visibleLatticeRange(w, h);
      ctx.strokeStyle = "rgba(255, 215, 90, 0.28)";
      ctx.lineWidth = dpr;
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
    if (showCell) {
      const origin = ws(0, 0, w, h);
      const p1 = ws(omega1.x, omega1.y, w, h);
      const p2 = ws(omega1.x + omega2.x, omega1.y + omega2.y, w, h);
      const p3 = ws(omega2.x, omega2.y, w, h);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1.5 * dpr;
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
        // Map tile UV → canvas pixel.
        // Screen shader: uv.x = fragCoord.x/w, uv.y = 1 - fragCoord.y/h  (GL fragCoord from bottom)
        // Canvas cy is from top, so cy = h - fragCoord.y = h - (1-uv.y)*h = uv.y*h
        const uvToScreen = (uv: Vec2) => ({ x: uv.x * w, y: uv.y * h });

        const drawCross = (s: {x:number,y:number}) => {
          ctx.beginPath(); ctx.moveTo(s.x - R, s.y - R); ctx.lineTo(s.x + R, s.y + R); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s.x + R, s.y - R); ctx.lineTo(s.x - R, s.y + R); ctx.stroke();
        };

        // Poles at all four corners
        const poleUVs = [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}];
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 7 * dpr;
        for (const uv of poleUVs) drawCross(uvToScreen(uv));
        ctx.strokeStyle = "rgba(0,0,0,1.0)"; ctx.lineWidth = 2.5 * dpr;
        for (const uv of poleUVs) drawCross(uvToScreen(uv));

        // Zeros at their UV positions
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

        // Helper: draw all pole × positions
        const drawPoles = () => {
          for (let m = mMin; m <= mMax; m++) {
            for (let n = nMin; n <= nMax; n++) {
              const s = ws(m * omega1.x + n * omega2.x, m * omega1.y + n * omega2.y, w, h);
              ctx.beginPath(); ctx.moveTo(s.x - R, s.y - R); ctx.lineTo(s.x + R, s.y + R); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(s.x + R, s.y - R); ctx.lineTo(s.x - R, s.y + R); ctx.stroke();
            }
          }
        };
        // Helper: draw all zero ○ positions
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
    if (showOmega) {
      const origin = ws(0, 0, w, h);
      const w1s = ws(omega1.x, omega1.y, w, h);
      const w2s = ws(omega2.x, omega2.y, w, h);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 2.5 * dpr;
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(w1s.x, w1s.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(w2s.x, w2s.y); ctx.stroke();

      // origin dot
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.beginPath(); ctx.arc(origin.x, origin.y, 3.5 * dpr, 0, Math.PI * 2); ctx.fill();

      // handles with subtle hover/drag feedback
      const drawHandle = (s: Vec2, key: "omega1" | "omega2") => {
        const active = hoverAnchor === key || drag?.kind === key;
        const r = (active ? 12 : 10.5) * dpr;
        if (active) {
          ctx.fillStyle = "rgba(255, 170, 70, 0.25)";
          ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = active ? "rgba(255, 165, 60, 1.0)" : "rgba(255, 140, 40, 1.0)";
        ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = (active ? 1.9 : 1.5) * dpr;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      };
      drawHandle(w1s, "omega1");
      drawHandle(w2s, "omega2");

      // labels inside handles
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.font = `600 ${Math.round(11 * dpr)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ω₁", w1s.x, w1s.y);
      ctx.fillText("ω₂", w2s.x, w2s.y);
    }

    ctx.restore();
  }

  // ── interaction ───────────────────────────────────────────────────────────

  /**
   * Project `proposed` onto the half-space det(ω₁,ω₂) ≥ MIN_DET,
   * keeping the point as close as possible to where the pointer is.
   * proposedIsOmega1=true  → proposed is ω₁, fixed is ω₂
   * proposedIsOmega1=false → proposed is ω₂, fixed is ω₁
   */
  function clampToPositiveDet(proposed: Vec2, fixed: Vec2, proposedIsOmega1: boolean): Vec2 {
    const MIN_DET = 1e-4;
    // det(ω₁,ω₂) = ω₁.x·ω₂.y − ω₁.y·ω₂.x
    const d = proposedIsOmega1
      ? proposed.x * fixed.y  - proposed.y * fixed.x   // det(proposed, ω₂)
      : fixed.x   * proposed.y - fixed.y  * proposed.x; // det(ω₁, proposed)
    if (d >= MIN_DET) return proposed;
    // Gradient of det w.r.t. the proposed vector:
    //   ∂det/∂ω₁ = (ω₂.y, −ω₂.x)    ∂det/∂ω₂ = (−ω₁.y, ω₁.x)
    const [gx, gy] = proposedIsOmega1
      ? [ fixed.y, -fixed.x]
      : [-fixed.y,  fixed.x];
    const mag2 = gx * gx + gy * gy;
    if (mag2 < 1e-12) return proposed;
    const t = (MIN_DET - d) / mag2;
    return { x: proposed.x + t * gx, y: proposed.y + t * gy };
  }

  function pointerToWorld(e: PointerEvent): Vec2 {
    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const rect = overlayCanvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width  * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    return screenToWorld((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr, w, h, pan.x, pan.y, zoom);
  }

  function anchorHitTest(e: PointerEvent): "omega1" | "omega2" | null {
    if (viewMode === "torus") return null;
    const dpr = Math.min(devicePixelRatio ?? 1, 2);
    const rect = overlayCanvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const w1s = worldToScreen(omega1.x, omega1.y, w, h, pan.x, pan.y, zoom);
    const w2s = worldToScreen(omega2.x, omega2.y, w, h, pan.x, pan.y, zoom);
    const d1 = Math.hypot(mx - w1s.x, my - w1s.y);
    const d2 = Math.hypot(mx - w2s.x, my - w2s.y);
    if (d1 < 18 * dpr) return "omega1";
    if (d2 < 18 * dpr) return "omega2";
    return null;
  }

  function handlePointerDown(e: PointerEvent) {
    if (viewMode === "torus") return;  // torus: no pan/zoom/drag
    const hit = anchorHitTest(e);
    if (hit === "omega1") drag = { kind: "omega1" };
    else if (hit === "omega2") drag = { kind: "omega2" };
    else drag = { kind: "pan", x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }

  const PAN_SPEED = 260;

  function handlePointerMove(e: PointerEvent) {
    if (!drag) {
      hoverAnchor = anchorHitTest(e);
      return;
    }
    if (drag.kind === "pan") {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag = { kind: "pan", x: e.clientX, y: e.clientY };
      pan = { x: pan.x - dx / PAN_SPEED / zoom, y: pan.y + dy / PAN_SPEED / zoom };
      hoverAnchor = null;
      return;
    }
    const next = pointerToWorld(e);
    if (drag.kind === "omega1") omega1 = clampToPositiveDet(next, omega2, true);
    else omega2 = clampToPositiveDet(next, omega1, false);
    hoverAnchor = drag.kind;
  }

  function handlePointerUp(e: PointerEvent) {
    drag = null;
    hoverAnchor = anchorHitTest(e);
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }

  function handlePointerLeave() {
    if (!drag) hoverAnchor = null;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (viewMode === "torus") return;
    zoom = clamp(zoom * Math.exp(-e.deltaY * 0.0012), 0.35, 10);
  }

  onMount(() => {
    const onResize = () => {
      if (!glCanvas || !overlayCanvas || !container) return;
      const dpr = Math.min(devicePixelRatio ?? 1, 2);
      const w = Math.max(1, Math.floor(container.clientWidth  * dpr));
      const h = Math.max(1, Math.floor(container.clientHeight * dpr));
      glCanvas.width = w; glCanvas.height = h;
      overlayCanvas.width = w; overlayCanvas.height = h;
      untrack(() => { sizeVersion++; });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
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
>
  <canvas bind:this={glCanvas}      class="gl-canvas"></canvas>
  <canvas bind:this={overlayCanvas} class="overlay-canvas"></canvas>
  <div class="hint">
    <span>drag ω₁ or ω₂ · pan background</span>
    <span>scroll to zoom</span>
  </div>
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
