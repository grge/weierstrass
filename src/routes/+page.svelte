<script lang="ts">
  import { onMount } from "svelte";
  import EllipticFunctionPane from "./EllipticFunctionPane.svelte";
  import ModularFormPane from "./ModularFormPane.svelte";
  import EllipticCurvePane from "./EllipticCurvePane.svelte";
  import PaneCard from "./PaneCard.svelte";
  import { basisFromTau, tauFromBasis, getScale } from "$lib/lattice";
  import { compileExpression } from "$lib/expression/compile";
  import { computeG2G3 } from "$lib/curve";
  import type { Vec2, ColorMode, ViewMode, RenderMode } from "$lib/types";

  let tauState: Vec2 = $state({ x: 0.25, y: 1.2 });
  let scaleState: number = $state(1);
  let angleState: number = $state(0);

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
  let modularTileSize: number = $state(400);
  let modularTerms: number = $state(20);

  // ── Pane state ────────────────────────────────────────────────────────────
  let primaryPane: "ellipticFunction" | "modularForm" | "ellipticCurve" = $state("ellipticFunction");
  let modularForm: "j" | "delta" | "e4" | "e6" = $state("j");

  const sidebarMode = $derived.by(() => {
    if (primaryPane === "ellipticCurve") return "adjacent";
    if (primaryPane === "modularForm")   return "overlay";
    return viewMode === "torus" ? "adjacent" : "overlay";
  });

  // ── Expression engine state ───────────────────────────────────────────────
  let expr: string = $state("wp");
  let exprStatus: "ok" | "error" = $state("ok");
  let exprError: string = $state("");
  let exprGlslBody: string = $state("");  // cached compiled GLSL body

  // ── Curve view state ──────────────────────────────────────────────────────
  const basis = $derived(basisFromTau(tauState, scaleState, angleState));
  const omega1 = $derived(basis.omega1);
  const omega2 = $derived(basis.omega2);

  function setBasis(nextOmega1: Vec2, nextOmega2: Vec2) {
    const nextTau = tauFromBasis(nextOmega1, nextOmega2);
    tauState = { x: nextTau.x, y: Math.max(nextTau.y, 0.05) };
    scaleState = getScale(nextOmega1);
    angleState = Math.atan2(nextOmega1.y, nextOmega1.x);
  }

  const g2g3 = $derived(computeG2G3(omega1, omega2, terms));
  const g2 = $derived(g2g3.g2);
  const g3 = $derived(g2g3.g3);

  // ── URL state ─────────────────────────────────────────────────────────────

  function r4(n: number) { return Math.round(n * 10000) / 10000; }
  const COLOR_MODES: ColorMode[] = ["classic", "ember", "dusk", "contours"];

  // Default values for all state parameters
  const DEFAULTS = {
    tau: { x: 0.25, y: 1.2 },
    scale: 1,
    angle: 0,
    colorMode: "dusk" as ColorMode,
    viewMode: "plane" as ViewMode,
    tileSize: 512,
    terms: 5,
    modularTileSize: 400,
    modularTerms: 20,
    halo: 1.0,
    showGrid: false,
    showLattice: false,
    showCell: true,
    showSpecialPoints: false,
    showHalo: false,
    showOmega: true,
    primaryPane: "ellipticFunction" as const,
    modularForm: "j" as const,
    expr: "wp",
  };

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
    const tau = tauState;
    const scale = scaleState;
    const angle = angleState;
    const p = new URLSearchParams();

    // tau: only include if different from default
    const roundedTau = { x: r4(tau.x), y: r4(tau.y) };
    if (roundedTau.x !== DEFAULTS.tau.x || roundedTau.y !== DEFAULTS.tau.y) {
      p.set("tau", `${roundedTau.x},${roundedTau.y}`);
    }

    // scale: only include if different from default
    const roundedScale = r4(scale);
    if (roundedScale !== DEFAULTS.scale) {
      p.set("scale", String(roundedScale));
    }

    // angle: only include if different from default (0)
    const roundedAngle = r4(angle);
    if (roundedAngle !== DEFAULTS.angle) {
      p.set("angle", String(roundedAngle));
    }



    // colorMode: only include if different from default
    if (colorMode !== DEFAULTS.colorMode) {
      p.set("color", colorMode);
    }

    // viewMode: only include if different from default
    if (viewMode !== DEFAULTS.viewMode) {
      p.set("view", viewMode);
    }

    // tileSize: only include if different from default
    if (tileSize !== DEFAULTS.tileSize) {
      p.set("wp_tile", String(tileSize));
    }

    // terms: only include if different from default
    if (terms !== DEFAULTS.terms) {
      p.set("wp_terms", String(terms));
    }

    // modularTileSize: only include if different from default
    if (modularTileSize !== DEFAULTS.modularTileSize) {
      p.set("mod_tile", String(modularTileSize));
    }

    // modularTerms: only include if different from default
    if (modularTerms !== DEFAULTS.modularTerms) {
      p.set("mod_terms", String(modularTerms));
    }

    // halo: only include if different from default
    if (r4(halo) !== DEFAULTS.halo) {
      p.set("halo", String(r4(halo)));
    }

    // showGrid: only include if different from default (false)
    if (showGrid !== DEFAULTS.showGrid) {
      p.set("grid", showGrid ? "1" : "0");
    }

    // showLattice: only include if different from default (false)
    if (showLattice !== DEFAULTS.showLattice) {
      p.set("lattice", showLattice ? "1" : "0");
    }

    // showCell: only include if different from default (true), emit "0" when false
    if (showCell !== DEFAULTS.showCell) {
      p.set("cell", showCell ? "1" : "0");
    }

    // showSpecialPoints: only include if different from default (false)
    if (showSpecialPoints !== DEFAULTS.showSpecialPoints) {
      p.set("markers", showSpecialPoints ? "1" : "0");
    }

    // showHalo: only include if different from default (false)
    if (showHalo !== DEFAULTS.showHalo) {
      p.set("glow", showHalo ? "1" : "0");
    }

    // showOmega: only include if different from default (true)
    if (showOmega !== DEFAULTS.showOmega) {
      p.set("omega", showOmega ? "1" : "0");
    }

    // primaryPane: only include if different from default
    if (primaryPane !== DEFAULTS.primaryPane) {
      p.set("pane", primaryPane);
    }

    // expr: only include if different from default
    if (expr !== DEFAULTS.expr) {
      p.set("expr", expr);
    }

    // modularForm: only include if different from default
    if (modularForm !== DEFAULTS.modularForm) {
      p.set("mod_form", modularForm);
    }

    // Return empty string if all params are default, otherwise return query string
    const qs = p.toString();
    return qs.length > 0 ? `?${qs}` : "";
  }

  function applyState(search: string) {
    const p = new URLSearchParams(search);
    const bool = (k: string, def: boolean) => {
      const v = p.get(k);
      if (v === null) return def;
      return v !== "0";
    };

    const tau = parsePair(p.get("tau"), { x: 0.25, y: 1.2 });
    tauState = { x: tau.x, y: Math.max(Math.abs(tau.y) < 0.05 ? 0.05 : tau.y, 0.05) };
    scaleState = parseNum(p.get("scale"), 1);
    angleState = parseNum(p.get("angle"), 0);

    colorMode = parseColorMode(p.get("color"));
    halo = parseNum(p.get("halo"), 1.0);
    viewMode = p.get("view") === "torus" ? "torus" : "plane";
    tileSize = parseIntRange(p.get("wp_tile") ?? p.get("tile"), 512, 64, 1024, 32);
    terms = parseIntRange(p.get("wp_terms") ?? p.get("terms"), 5, 1, 20, 1);
    modularTileSize = parseIntRange(p.get("mod_tile") ?? p.get("tau_tile"), 400, 100, 1200, 50);
    modularTerms = parseIntRange(p.get("mod_terms") ?? p.get("tau_terms"), 20, 5, 60, 5);
    showGrid = bool("grid", false);
    showLattice = bool("lattice", false);
    showCell = bool("cell", true);
    showSpecialPoints = bool("markers", false);
    showHalo = bool("glow", false);
    showOmega = bool("omega", true);
    const paneParam = p.get("pane");
    if (paneParam === "modularForm" || paneParam === "ellipticCurve") {
      primaryPane = paneParam;
    } else {
      primaryPane = "ellipticFunction";
    }
    const modFormParam = p.get("mod_form");
    if (modFormParam === "j" || modFormParam === "delta" || modFormParam === "e4" || modFormParam === "e6") {
      modularForm = modFormParam;
    } else {
      modularForm = "j";
    }
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
    void [tauState.x, tauState.y, scaleState, angleState, colorMode,
          halo, viewMode, tileSize, terms, modularTileSize, modularTerms, showGrid, showLattice, showCell,
          showSpecialPoints, showHalo, showOmega, expr, primaryPane, modularForm];
    if (_skipNextWrite) { _skipNextWrite = false; return; }
    const qs = encodeState();
    const newPath = qs ? window.location.pathname + qs : window.location.pathname;
    if (window.location.search !== qs) history.replaceState(null, '', newPath);
  });

  // ── App state ─────────────────────────────────────────────────────────────

  const tau = $derived(tauState);

  const COLOR_MODE_INDEX: Record<ColorMode, RenderMode> = {
    classic: 0,
    ember: 1,
    dusk: 2,
    contours: 3,
  };

  function reset() {
    tauState = { ...DEFAULTS.tau };
    scaleState = DEFAULTS.scale;
    angleState = DEFAULTS.angle;
    colorMode = DEFAULTS.colorMode;
    halo = DEFAULTS.halo;
    showHalo = DEFAULTS.showHalo;
    tileSize = DEFAULTS.tileSize;
    terms = DEFAULTS.terms;
    modularTileSize = DEFAULTS.modularTileSize;
    modularTerms = DEFAULTS.modularTerms;
    viewMode = DEFAULTS.viewMode;
    showGrid = DEFAULTS.showGrid;
    showLattice = DEFAULTS.showLattice;
    showCell = DEFAULTS.showCell;
    showSpecialPoints = DEFAULTS.showSpecialPoints;
    showOmega = DEFAULTS.showOmega;
    primaryPane = DEFAULTS.primaryPane;
    modularForm = DEFAULTS.modularForm;
    expr = DEFAULTS.expr;
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
    <!-- Primary pane viewport -->
    <div class="viewport-container">
      {#if primaryPane === "ellipticFunction"}
        <EllipticFunctionPane
          mode="primary"
          {omega1}
          {omega2}
          onBasisChange={setBasis}
          {tau}
          renderMode={COLOR_MODE_INDEX[colorMode]}
          {halo}
          bind:tileSize
          bind:terms
          bind:viewMode
          showGrid={viewMode === "plane" && showGrid}
          showLattice={viewMode === "plane" && showLattice}
          showCell={viewMode === "plane" && showCell}
          showOmega={viewMode === "plane" && showOmega}
          {showSpecialPoints}
          bind:showHalo
          tileUpdatesPerSec={tileUpdatesPerSec}
          {expr}
          {exprStatus}
          {exprError}
          {exprGlslBody}
          onExprChange={(newExpr) => (expr = newExpr)}
          bind:colorMode
          {g2}
          {g3}
        />
      {:else if primaryPane === "modularForm"}
        <ModularFormPane
          mode="primary"
          {omega1}
          {omega2}
          onBasisChange={setBasis}
          bind:modularTileSize
          bind:modularTerms
          bind:modularForm
          colorMode={COLOR_MODE_INDEX[colorMode]}
          {showGrid}
        />
      {:else}
        <EllipticCurvePane
          mode="primary"
          {omega1}
          {omega2}
          {showGrid}
        />
      {/if}

      {#if !sidebarOpen}
        <button class="open-btn" onclick={() => (sidebarOpen = true)} title="Show controls">&laquo;</button>
      {/if}
    </div>

    <!-- Sidebar with pane cards + static settings -->
    <aside class="sidebar" class:hidden={!sidebarOpen} class:overlay={sidebarMode === "overlay"}>
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

      <!-- Elliptic Function pane card -->
      <PaneCard
        label="Elliptic function"
        isPrimary={primaryPane === "ellipticFunction"}
        onPromote={() => (primaryPane = "ellipticFunction")}
      >
        {#snippet children()}
          <EllipticFunctionPane
            mode="sidebar"
            isPrimary={primaryPane === "ellipticFunction"}
            {omega1}
            {omega2}
            onBasisChange={setBasis}
            {tau}
            renderMode={COLOR_MODE_INDEX[colorMode]}
            {halo}
            bind:tileSize
            bind:terms
            bind:viewMode
            {showGrid}
            {showLattice}
            {showCell}
            {showOmega}
            {showSpecialPoints}
            bind:showHalo
            tileUpdatesPerSec={tileUpdatesPerSec}
            {expr}
            {exprStatus}
            {exprError}
            {exprGlslBody}
            onExprChange={(newExpr) => (expr = newExpr)}
            bind:colorMode
            {g2}
            {g3}
          />
        {/snippet}
      </PaneCard>

      <!-- Modular Form pane card -->
      <PaneCard
        label="Modular form"
        isPrimary={primaryPane === "modularForm"}
        onPromote={() => (primaryPane = "modularForm")}
      >
        {#snippet children()}
          <ModularFormPane
            mode="sidebar"
            isPrimary={primaryPane === "modularForm"}
            {omega1}
            {omega2}
            onBasisChange={setBasis}
            bind:modularTileSize
            bind:modularTerms
            bind:modularForm
            colorMode={COLOR_MODE_INDEX[colorMode]}
            {showGrid}
          />
        {/snippet}
      </PaneCard>

      <!-- Elliptic Curve pane card -->
      <PaneCard
        label="Elliptic curve"
        isPrimary={primaryPane === "ellipticCurve"}
        onPromote={() => (primaryPane = "ellipticCurve")}
      >
        {#snippet children()}
          <EllipticCurvePane
            mode="sidebar"
            isPrimary={primaryPane === "ellipticCurve"}
            {omega1}
            {omega2}
            {showGrid}
          />
        {/snippet}
      </PaneCard>

      <!-- Static settings sections -->
      <!-- Domain colouring -->
      <details>
        <summary>Domain colouring</summary>
        <div class="section-body">
          <label>Mode
            <select bind:value={colorMode}>
              <option value="classic">Classic</option>
              <option value="ember">Ember</option>
              <option value="dusk">Dusk</option>
              <option value="contours">Contours</option>
            </select>
          </label>
        </div>
      </details>

      <!-- Overlays -->
      <details>
        <summary>Overlays</summary>
        <div class="section-body overlays">
          <label class="overlay-row" class:torus-disabled={viewMode === "torus"}>
            <input type="checkbox" bind:checked={showGrid} disabled={viewMode === "torus"} />
            <svg class="swatch" viewBox="0 0 28 14" fill="none">
              <line x1="0" y1="7" x2="28" y2="7" stroke="rgba(160,210,255,0.7)" stroke-width="1.5"/>
              <line x1="14" y1="0" x2="14" y2="14" stroke="rgba(160,210,255,0.7)" stroke-width="1.5"/>
              <line x1="0" y1="3.5" x2="28" y2="3.5" stroke="rgba(160,210,255,0.35)" stroke-width="1"/>
              <line x1="0" y1="10.5" x2="28" y2="10.5" stroke="rgba(160,210,255,0.35)" stroke-width="1"/>
              <line x1="7" y1="0" x2="7" y2="14" stroke="rgba(160,210,255,0.35)" stroke-width="1"/>
              <line x1="21" y1="0" x2="21" y2="14" stroke="rgba(160,210,255,0.35)" stroke-width="1"/>
            </svg>
            Grid
          </label>

          <label class="overlay-row" class:torus-disabled={viewMode === "torus"}>
            <input type="checkbox" bind:checked={showLattice} disabled={viewMode === "torus"} />
            <svg class="swatch" viewBox="0 0 28 14" fill="none">
              <path d="M2,12 L10,2 L26,2 L18,12 Z" stroke="rgba(255,215,90,0.6)" stroke-width="1.5"/>
              <path d="M10,2 L18,12" stroke="rgba(255,215,90,0.4)" stroke-width="1" stroke-dasharray="2,2"/>
            </svg>
            Cell lattice
          </label>

          <label class="overlay-row" class:torus-disabled={viewMode === "torus"}>
            <input type="checkbox" bind:checked={showCell} disabled={viewMode === "torus"} />
            <svg class="swatch" viewBox="0 0 28 14" fill="none">
              <rect x="3" y="2" width="22" height="10" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-dasharray="4,3"/>
            </svg>
            Fundamental cell
          </label>

          <label class="overlay-row disabled" title="Temporarily unavailable for custom expressions">
            <input type="checkbox" disabled />
            <svg class="swatch" viewBox="0 0 28 14" fill="none">
              <line x1="3" y1="3" x2="9" y2="9" stroke="rgba(255,80,80,0.9)" stroke-width="1.5"/>
              <line x1="9" y1="3" x2="3" y2="9" stroke="rgba(255,80,80,0.9)" stroke-width="1.5"/>
              <circle cx="20" cy="7" r="4" stroke="rgba(80,210,175,0.9)" stroke-width="1.5"/>
            </svg>
            Poles &amp; zeros markers
          </label>

          <label class="overlay-row">
            <input type="checkbox" bind:checked={showHalo} />
            <svg class="swatch" viewBox="0 0 28 14" fill="none">
              <defs>
                <radialGradient id="pg" cx="25%" cy="50%" r="25%">
                  <stop offset="0%" stop-color="white" stop-opacity="1"/>
                  <stop offset="100%" stop-color="white" stop-opacity="0"/>
                </radialGradient>
                <radialGradient id="zg" cx="75%" cy="50%" r="25%">
                  <stop offset="0%" stop-color="black" stop-opacity="1"/>
                  <stop offset="100%" stop-color="black" stop-opacity="0"/>
                </radialGradient>
              </defs>
              <rect width="28" height="14" fill="rgba(80,40,20,0.6)"/>
              <circle cx="7" cy="7" r="6" fill="url(#pg)"/>
              <circle cx="21" cy="7" r="6" fill="url(#zg)"/>
            </svg>
            Pole &amp; zero glow
          </label>

          <label class="overlay-row" class:torus-disabled={viewMode === "torus"}>
            <input type="checkbox" bind:checked={showOmega} disabled={viewMode === "torus"} />
            <svg class="swatch" viewBox="0 0 28 14" fill="none">
              <line x1="4" y1="12" x2="20" y2="4" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
              <circle cx="20" cy="4" r="4" fill="rgba(255,140,40,1)" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
              <circle cx="4" cy="12" r="2" fill="rgba(255,255,255,0.7)"/>
            </svg>
            ω₁ / ω₂ vectors
          </label>
        </div>
      </details>

      <!-- Performance -->
      <details>
        <summary>Performance</summary>
        <div class="section-body">
          <label>
            <div class="slider-header"><span>℘ tile size</span><span class="val">{tileSize}px</span></div>
            <input type="range" min="64" max="1024" step="32" bind:value={tileSize} />
          </label>
          <label>
            <div class="slider-header"><span>℘ series terms</span><span class="val">{terms}</span></div>
            <input type="range" min="1" max="20" step="1" bind:value={terms} />
          </label>
          <label>
            <div class="slider-header"><span>Modular tile size</span><span class="val">{modularTileSize}px</span></div>
            <input type="range" min="100" max="1200" step="50" bind:value={modularTileSize} />
          </label>
          <label>
            <div class="slider-header"><span>Modular series terms</span><span class="val">{modularTerms}</span></div>
            <input type="range" min="5" max="60" step="5" bind:value={modularTerms} />
          </label>
          <div class="telemetry">
            <span class="telemetry-label">Tile renders</span>
            <span class="telemetry-val">{tileUpdatesPerSec}&thinsp;/s</span>
          </div>
        </div>
      </details>
    </aside>
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
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
  }

  .viewport-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .sidebar {
    width: 360px;
    height: 100%;
    overflow-y: auto;
    background: #120d0b;
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.5);
    transition: width 0.2s ease, opacity 0.2s ease;
    position: relative;
    flex-shrink: 0;
    font-size: 0.78rem;
    color: rgba(255, 220, 180, 0.9);
  }

  /* Overlay mode (for plane view) */
  .sidebar.overlay {
    position: absolute;
    top: 0;
    right: 0;
    height: 100%;
    z-index: 100;
    background: rgba(18, 13, 11, 0.98);
    flex-shrink: unset;
  }

  .sidebar.hidden {
    width: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
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
    z-index: 4;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .open-btn:hover {
    background: rgba(18, 13, 11, 0.85);
    border-color: rgba(255, 150, 60, 0.4);
    color: rgba(255, 200, 150, 0.95);
  }

  /* ── Collapsible sections (details) ── */
  :global(.sidebar) details {
    border-bottom: 1px solid rgba(255, 150, 60, 0.12);
  }
  :global(.sidebar) summary {
    display: flex;
    align-items: center;
    padding: 0.55rem 1rem;
    cursor: pointer;
    user-select: none;
    font-size: 0.70rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 200, 150, 0.6);
    list-style: none;
    gap: 0.5rem;
  }
  :global(.sidebar) summary::-webkit-details-marker { display: none; }
  :global(.sidebar) summary::before {
    content: "›";
    font-size: 1rem;
    transition: transform 0.15s ease;
    color: rgba(255, 150, 60, 0.5);
    line-height: 1;
  }
  :global(.sidebar) details[open] summary::before {
    transform: rotate(90deg);
  }
  :global(.sidebar) summary:hover {
    color: rgba(255, 220, 180, 0.85);
    background: rgba(255, 150, 60, 0.04);
  }

  /* ── Section body ── */
  .section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
  }

  /* ── Form controls ── */
  :global(.sidebar) label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: rgba(255, 220, 180, 0.8);
    font-size: 0.78rem;
  }
  :global(.sidebar) .slider-header {
    display: flex;
    justify-content: space-between;
  }
  :global(.sidebar) .val {
    color: rgba(255, 180, 100, 0.65);
    font-family: monospace;
    font-size: 0.75rem;
  }
  :global(.sidebar) select {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.2);
    color: rgba(255, 220, 180, 0.9);
    padding: 0.3rem 0.5rem;
    font-size: 0.78rem;
    font-family: inherit;
    width: 100%;
  }
  :global(.sidebar) input[type="range"] { width: 100%; accent-color: rgba(255, 150, 60, 0.8); }
  :global(.sidebar) input[type="checkbox"] { accent-color: rgba(255, 150, 60, 0.8); flex-shrink: 0; }
  :global(.sidebar) .telemetry {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-family: monospace;
    color: rgba(255, 180, 100, 0.5);
    padding-top: 0.25rem;
  }
  :global(.sidebar) .telemetry-val { color: rgba(255, 180, 100, 0.85); }
  :global(.sidebar) .overlays { gap: 0.55rem; }
  :global(.sidebar) .overlay-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.55rem;
    color: rgba(255, 220, 180, 0.8);
    cursor: pointer;
    font-size: 0.78rem;
  }
  :global(.sidebar) .overlay-row.torus-disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }
  :global(.sidebar) .overlay-row.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  :global(.sidebar) .overlay-row.disabled input {
    cursor: not-allowed;
    opacity: 0.5;
  }
  :global(.sidebar) .swatch {
    width: 28px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.9;
  }
</style>
