<script lang="ts">
  import type { Vec2, ColorMode, ViewMode, RenderMode } from "$lib/types";
  import TauPicker from "./TauPicker.svelte";

  const COLOR_MODE_INDEX: Record<ColorMode, RenderMode> = {
    classic: 0, ember: 1, dusk: 2, contours: 3,
  };

  let {
    omega1 = $bindable(),
    omega2 = $bindable(),
    tileSize = $bindable(),
    terms = $bindable(),
    showGrid = $bindable(),
    showLattice = $bindable(),
    showCell = $bindable(),
    showSpecialPoints = $bindable(),
    showHalo = $bindable(),
    showOmega = $bindable(),
    viewMode = "plane",
    colorMode = $bindable(),
    tileUpdatesPerSec = 0,
    tauTileSize = $bindable(400),
    tauTerms = $bindable(20),
  }: {
    omega1: Vec2;
    omega2: Vec2;
    tileSize: number;
    terms: number;
    showGrid: boolean;
    showLattice: boolean;
    showCell: boolean;
    showSpecialPoints: boolean;
    showHalo: boolean;
    showOmega: boolean;
    viewMode: ViewMode;
    colorMode: ColorMode;
    tileUpdatesPerSec?: number;
    tauTileSize?: number;
    tauTerms?: number;
  } = $props();
</script>

<!-- ── Lattice shape ────────────────────────────────── -->
<details open>
  <summary>Lattice shape (&#964;)</summary>
  <TauPicker bind:omega1 bind:omega2 colorMode={COLOR_MODE_INDEX[colorMode]} {showGrid} bind:tauTileSize bind:tauTerms />
</details>

<!-- ── Domain colouring ─────────────────────────────── -->
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

<!-- ── Overlays ──────────────────────────────────────── -->
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
      Complex grid
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

    <label class="overlay-row">
      <input type="checkbox" bind:checked={showSpecialPoints} />
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
        <radialGradient id="pg" cx="25%" cy="50%" r="25%">
          <stop offset="0%" stop-color="white" stop-opacity="1"/>
          <stop offset="100%" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="zg" cx="75%" cy="50%" r="25%">
          <stop offset="0%" stop-color="black" stop-opacity="1"/>
          <stop offset="100%" stop-color="black" stop-opacity="0"/>
        </radialGradient>
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

<!-- ── Performance ──────────────────────────────────── -->
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
      <div class="slider-header"><span>τ tile size</span><span class="val">{tauTileSize}px</span></div>
      <input type="range" min="100" max="1200" step="50" bind:value={tauTileSize} />
    </label>
    <label>
      <div class="slider-header"><span>τ series terms</span><span class="val">{tauTerms}</span></div>
      <input type="range" min="5" max="60" step="5" bind:value={tauTerms} />
    </label>
    <div class="telemetry">
      <span class="telemetry-label">Tile renders</span>
      <span class="telemetry-val">{tileUpdatesPerSec}&thinsp;/s</span>
    </div>
  </div>
</details>

<style>
  /* ── base ── */
  :global(.sidebar) {
    font-size: 0.78rem;
    color: rgba(255, 220, 180, 0.9);
    font-family: system-ui, sans-serif;
  }

  /* ── collapsible sections ── */
  details {
    border-bottom: 1px solid rgba(255, 150, 60, 0.12);
  }
  summary {
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
  summary::-webkit-details-marker { display: none; }
  summary::before {
    content: '›';
    font-size: 1rem;
    transition: transform 0.15s ease;
    color: rgba(255, 150, 60, 0.5);
    line-height: 1;
  }
  details[open] summary::before {
    transform: rotate(90deg);
  }
  summary:hover {
    color: rgba(255, 220, 180, 0.85);
    background: rgba(255, 150, 60, 0.04);
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
  }

  /* ── form controls ── */
  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: rgba(255, 220, 180, 0.8);
    font-size: 0.78rem;
  }
  .slider-header {
    display: flex;
    justify-content: space-between;
  }
  .val {
    color: rgba(255, 180, 100, 0.65);
    font-family: monospace;
    font-size: 0.75rem;
  }
  select {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.2);
    color: rgba(255, 220, 180, 0.9);
    padding: 0.3rem 0.5rem;
    font-size: 0.78rem;
    font-family: inherit;
    width: 100%;
  }
  input[type="range"] { width: 100%; accent-color: rgba(255, 150, 60, 0.8); }
  input[type="checkbox"] { accent-color: rgba(255, 150, 60, 0.8); flex-shrink: 0; }
  .telemetry {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-family: monospace;
    color: rgba(255, 180, 100, 0.5);
    padding-top: 0.25rem;
  }
  .telemetry-val { color: rgba(255, 180, 100, 0.85); }
  .overlays { gap: 0.55rem; }
  .overlay-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.55rem;
    color: rgba(255, 220, 180, 0.8);
    cursor: pointer;
    font-size: 0.78rem;
  }
  .overlay-row.torus-disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }
  .swatch {
    width: 28px;
    height: 14px;
    flex-shrink: 0;
    opacity: 0.9;
  }
</style>
