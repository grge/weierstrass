<script lang="ts">
  import { onMount } from "svelte";
  import Viewport from "./Viewport.svelte";
  import Controls from "./Controls.svelte";
  import ExpressionOverlay from "./ExpressionOverlay.svelte";
  import { basisFromTau, tauFromBasis } from "$lib/lattice";
  import { compileExpression } from "$lib/expression/compile";
  import { computeG2G3 } from "$lib/curve";
  import { wpEval, wpPrimeEval } from "$lib/math";
  import type { Vec2, ColorMode, ViewMode, RenderMode } from "$lib/types";

  let omega1: Vec2 = $state({ x: 1, y: 0 });
  let omega2: Vec2 = $state({ x: 0.25, y: 1.2 });
  let zoom: number = $state(0.8);
  let pan: Vec2 = $state({ x: 0.8, y: 0.7 });
  let colorMode: ColorMode = $state("dusk");
  let halo:          number = $state(1);
  let showHalo:      boolean = $state(false);
  let tileSize: number = $state(512);
  let terms: number = $state(5);
  let viewMode: ViewMode = $state("plane");
  let showGrid:          boolean = $state(false);
  let showLattice:       boolean = $state(false);
  let showCell:          boolean = $state(true);
  let showSpecialPoints: boolean = $state(false);
  let showOmega:         boolean = $state(true);
  let sidebarOpen: boolean = $state(true);
  let tileUpdatesPerSec: number = $state(0);
  let tauTileSize: number = $state(400);
  let tauTerms: number = $state(20);

  // ── Expression engine state ───────────────────────────────────────────────
  let expr: string = $state("wp");
  let exprStatus: "ok" | "error" = $state("ok");
  let exprError: string = $state("");
  let exprGlslBody: string = $state("");  // cached compiled GLSL body

  // ── Curve view state ──────────────────────────────────────────────────────
  const g2g3 = $derived(computeG2G3(omega1, omega2, terms));
  const g2 = $derived(g2g3.g2);
  const g3 = $derived(g2g3.g3);

  // ── URL state ─────────────────────────────────────────────────────────────

  function r4(n: number) { return Math.round(n * 10000) / 10000; }
  const COLOR_MODES: ColorMode[] = ["classic", "ember", "dusk", "contours"];

  function parseNum(value: string | null, fallback: number): number {
    const n = value === null ? NaN : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function parsePair(value: string | null, fallback: Vec2): Vec2 {
    if (value === null) return fallback;
    const [xs, ys] = value.split(",", 2);
    return {
      x: parseNum(xs ?? null, fallback.x),
      y: parseNum(ys ?? null, fallback.y),
    };
  }

  function parseIntRange(value: string | null, fallback: number, min: number, max: number, step = 1): number {
    const n = parseNum(value, fallback);
    const rounded = Math.round(n / step) * step;
    return Math.max(min, Math.min(max, rounded));
  }

  function parseColorMode(value: string | null, fallback: ColorMode = "dusk"): ColorMode {
    return COLOR_MODES.includes(value as ColorMode) ? (value as ColorMode) : fallback;
  }

  function encodeState() {
    const tau = tauFromBasis(omega1, omega2);
    const scale = Math.sqrt(omega1.x ** 2 + omega1.y ** 2);
    const angle = Math.atan2(omega1.y, omega1.x);
    const p = new URLSearchParams();
    p.set("tau", `${r4(tau.x)},${r4(tau.y)}`);
    p.set("scale", String(r4(scale)));
    const roundedAngle = r4(angle);
    if (roundedAngle !== 0) p.set("angle", String(roundedAngle));
    p.set("zoom", String(r4(zoom)));
    p.set("pan", `${r4(pan.x)},${r4(pan.y)}`);
    p.set("color", colorMode);
    p.set("view", viewMode);
    p.set("wp_tile", String(tileSize));
    p.set("wp_terms", String(terms));
    p.set("tau_tile", String(tauTileSize));
    p.set("tau_terms", String(tauTerms));
    p.set("halo", String(r4(halo)));
    p.set("grid", showGrid ? "1" : "0");
    p.set("lattice", showLattice ? "1" : "0");
    p.set("cell", showCell ? "1" : "0");
    p.set("markers", showSpecialPoints ? "1" : "0");
    p.set("glow", showHalo ? "1" : "0");
    p.set("omega", showOmega ? "1" : "0");
    if (expr !== "wp") p.set("expr", expr);
    return `?${p.toString()}`;
  }

  function applyState(search: string) {
    const p = new URLSearchParams(search);
    const bool = (k: string, def: boolean) => {
      const v = p.get(k);
      if (v === null) return def;
      return v !== "0";
    };

    const tau = parsePair(p.get("tau"), { x: 0.25, y: 1.2 });
    const scale = parseNum(p.get("scale"), 1);
    const angle = parseNum(p.get("angle"), 0);
    const tauY = Math.max(Math.abs(tau.y) < 0.05 ? 0.05 : tau.y, 0.05);
    const basis = basisFromTau({ x: tau.x, y: tauY }, scale, angle);
    omega1 = basis.omega1;
    omega2 = basis.omega2;

    zoom = parseNum(p.get("zoom"), 0.8);
    pan = parsePair(p.get("pan"), { x: 0.8, y: 0.7 });
    colorMode = parseColorMode(p.get("color"));
    halo = parseNum(p.get("halo"), 1.0);
    viewMode = p.get("view") === "torus" ? "torus" : "plane";
    tileSize = parseIntRange(p.get("wp_tile") ?? p.get("tile"), 512, 64, 1024, 32);
    terms = parseIntRange(p.get("wp_terms") ?? p.get("terms"), 5, 1, 20, 1);
    tauTileSize = parseIntRange(p.get("tau_tile"), 400, 100, 1200, 50);
    tauTerms = parseIntRange(p.get("tau_terms"), 20, 5, 60, 5);
    showGrid = bool("grid", false);
    showLattice = bool("lattice", false);
    showCell = bool("cell", true);
    showSpecialPoints = bool("markers", false);
    showHalo = bool("glow", false);
    showOmega = bool("omega", true);
    expr = p.get("expr") ?? "wp";
  }

  let _skipNextWrite = false;

  onMount(() => {
    if (window.location.search.length > 1) {
      try {
        _skipNextWrite = true;
        applyState(window.location.search);
      } catch { /* ignore malformed params */ }
    }
  });

  $effect(() => {
    void [omega1, omega2, zoom, pan.x, pan.y, colorMode,
          halo, viewMode, tileSize, terms, tauTileSize, tauTerms, showGrid, showLattice, showCell,
          showSpecialPoints, showHalo, showOmega, expr];
    if (_skipNextWrite) { _skipNextWrite = false; return; }
    const qs = encodeState();
    if (window.location.search !== qs) history.replaceState(null, '', qs);
  });

  // ── App state ─────────────────────────────────────────────────────────────

  const tau = $derived(tauFromBasis(omega1, omega2));

  const COLOR_MODE_INDEX: Record<ColorMode, RenderMode> = {
    classic: 0,
    ember: 1,
    dusk: 2,
    contours: 3,
  };
  const modeIndex = $derived(COLOR_MODE_INDEX[colorMode]);

  function reset() {
    omega1 = { x: 1, y: 0 };
    omega2 = { x: 0.25, y: 1.2 };
    zoom = 0.8;
    pan = { x: 0.8, y: 0.7 };
    colorMode = "dusk";
    halo = 1;
    showHalo = false;
    tileSize = 512;
    terms = 5;
    tauTileSize = 400;
    tauTerms = 20;
    viewMode = "plane";
    showGrid = false;
    showLattice = false;
    showCell = true;
    showSpecialPoints = false;
    showOmega = true;
    expr = "wp";
  }

  // ── Expression compilation effect ───────────────────────────────────────────
  // Always compile expression (even default "wp") to GLSL body
  $effect(() => {
    expr;  // reactive dependency
    const result = compileExpression(expr);
    if (result.ok) {
      exprStatus = "ok";
      exprError = "";
      exprGlslBody = result.glslBody;
    } else {
      exprStatus = "error";
      exprError = result.error;
      // Keep previous exprGlslBody on error so rendering continues
    }
  });
</script>

<svelte:head>
  <title>Weierstrass ℘</title>
</svelte:head>

<div class="app">
  <div class="stage">
    <Viewport
      bind:omega1
      bind:omega2
      bind:zoom
      bind:pan
      {tau}
      mode={modeIndex}
      {halo}
      {tileSize}
      {terms}
      {viewMode}
      showGrid={viewMode === "plane" && showGrid}
      showLattice={viewMode === "plane" && showLattice}
      showCell={viewMode === "plane" && showCell}
      showOmega={viewMode === "plane" && showOmega}
      {showSpecialPoints}
      {showHalo}
      bind:tileUpdatesPerSec
      {expr}
      {exprStatus}
      {exprError}
      {exprGlslBody}
      onExprChange={(newExpr) => (expr = newExpr)}
      {g2}
      {g3}
    />

    <aside class="sidebar" class:open={sidebarOpen}>
      <div class="sidebar-header">
        <span class="sidebar-title">Weierstrass ℘</span>
        <div class="sidebar-actions">
          <a
            class="header-link"
            href="https://github.com/grge/weierstrass"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27
                c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
                .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
                0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
          <button class="header-btn" onclick={reset} title="Reset to defaults">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
          </button>
          <button class="header-btn close-btn" onclick={() => (sidebarOpen = false)} title="Hide controls">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707
                8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293
                8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </div>
      <Controls
        bind:omega1
        bind:omega2
        bind:tileSize
        bind:terms
        {viewMode}
        bind:showGrid
        bind:showLattice
        bind:showCell
        bind:showSpecialPoints
        bind:showHalo
        bind:showOmega
        bind:colorMode
        {tileUpdatesPerSec}
        bind:tauTileSize
        bind:tauTerms
        {g2}
        {g3}
      />
    </aside>

    {#if !sidebarOpen}
      <button class="open-btn" onclick={() => (sidebarOpen = true)} title="Show controls">&laquo;</button>
    {/if}
  </div>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body, html) {
    margin: 0;
    height: 100%;
    background: #171210;
    color: rgba(255, 220, 180, 0.9);
    font-family: system-ui, sans-serif;
    overflow: hidden;
  }

  .app {
    height: 100vh;
  }

  .stage {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .sidebar {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    width: 360px;
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.2s ease;
    z-index: 10;
    background: #120d0b;
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.5);
  }
  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid rgba(255, 150, 60, 0.18);
    background: #120d0b;
    flex-shrink: 0;
  }

  .sidebar-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 220, 180, 0.9);
    letter-spacing: 0.03em;
    user-select: none;
  }

  .sidebar-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .header-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
    color: rgba(255, 200, 150, 0.45);
    text-decoration: none;
    border-radius: 0.3rem;
    transition: color 0.15s, background 0.15s;
  }
  .header-link:hover {
    color: rgba(255, 220, 180, 0.9);
    background: rgba(255, 150, 60, 0.1);
  }

  .header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.8rem;
    height: 1.8rem;
    background: none;
    border: none;
    color: rgba(255, 200, 150, 0.45);
    border-radius: 0.3rem;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    padding: 0;
  }
  .header-btn:hover {
    color: rgba(255, 220, 180, 0.9);
    background: rgba(255, 150, 60, 0.1);
  }
  .close-btn:hover {
    color: rgba(255, 120, 80, 0.9);
  }

  .open-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: rgba(18, 13, 11, 0.35);
    border: 1px solid rgba(255, 150, 60, 0.2);
    color: rgba(255, 200, 150, 0.5);
    border-radius: 0.4rem;
    width: 2rem;
    height: 2rem;
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .open-btn:hover {
    background: rgba(18, 13, 11, 0.85);
    border-color: rgba(255, 150, 60, 0.4);
    color: rgba(255, 200, 150, 0.95);
  }
</style>
