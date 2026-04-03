<script lang="ts">
  import { onMount } from "svelte";
  import Viewport from "./Viewport.svelte";
  import Controls from "./Controls.svelte";
  import { basisFromTau, tauFromBasis } from "$lib/lattice";
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
          showSpecialPoints, showHalo, showOmega];
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
  }
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
    />

    <!-- View mode toggle pill -->
    <div class="view-toggle" class:sidebar-open={sidebarOpen}>
      <button class:active={viewMode === "plane"} onclick={() => (viewMode = "plane")}>&#8450;</button>
      <button class:active={viewMode === "torus"} onclick={() => (viewMode = "torus")}>&#8450;/&#923;</button>
    </div>

    <aside class="sidebar" class:open={sidebarOpen}>
      <div class="sidebar-header">
        <button class="toggle" onclick={() => (sidebarOpen = false)} title="Hide controls">&raquo;</button>
        <button class="reset-btn" onclick={reset}>reset</button>
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

  .view-toggle {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    border: 1px solid rgba(255,150,60,0.35);
    overflow: hidden;
    z-index: 20;
    transition: left 0.2s ease;
  }
  .view-toggle.sidebar-open {
    left: calc(50% - 140px); /* shift left when sidebar is open */
  }
  .view-toggle button {
    background: rgba(18,13,11,0.82);
    border: none;
    color: rgba(255,200,150,0.55);
    padding: 5px 16px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.04em;
    backdrop-filter: blur(4px);
  }
  .view-toggle button + button {
    border-left: 1px solid rgba(255,150,60,0.35);
  }
  .view-toggle button.active {
    background: rgba(255,150,60,0.18);
    color: rgba(255,220,180,1);
  }
  .view-toggle button:hover:not(.active) {
    background: rgba(255,150,60,0.08);
    color: rgba(255,200,150,0.85);
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
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid rgba(255, 150, 60, 0.12);
    background: #120d0b;
  }

  .reset-btn {
    background: none;
    border: 1px solid rgba(255, 150, 60, 0.3);
    color: rgba(255, 200, 150, 0.7);
    border-radius: 0.25rem;
    padding: 0.15rem 0.5rem;
    font-size: 0.72rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .reset-btn:hover { background: rgba(255, 150, 60, 0.1); color: rgba(255, 200, 150, 1); }

  .toggle {
    background: none;
    border: 1px solid rgba(255, 150, 60, 0.3);
    color: rgba(255, 200, 150, 0.9);
    border-radius: 0.4rem;
    width: 1.8rem;
    height: 1.8rem;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toggle:hover { background: rgba(255, 150, 60, 0.1); }

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
