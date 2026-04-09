<script lang="ts">
  import EllipticFunctionView from "./EllipticFunctionView.svelte";
  import ExpressionOverlay from "./ExpressionOverlay.svelte";
  import type { Vec2, ColorMode, ViewMode, RenderMode } from "$lib/types";
  import { EXPR_PRESETS } from "$lib/expr-presets";
  import { getScale, scaleLattice, normalizeLattice, basisFromTau, tauFromBasis } from "$lib/lattice";

  let showPresetDropdown = $state(false);


  let {
    mode,
    isPrimary = false,
    omega1,
    omega2,
    tau,
    renderMode,
    halo,
    tileSize = $bindable(),
    terms = $bindable(),
    viewMode = $bindable(),
    showGrid,
    showLattice,
    showCell,
    showOmega,
    showSpecialPoints,
    showHalo = $bindable(),
    expr,
    exprStatus,
    exprError,
    exprGlslBody,
    onExprChange,
    tileUpdatesPerSec = 0,
    colorMode = $bindable(),
    g2 = 0,
    g3 = 0,
    onBasisChange,
  }: {
    mode: "primary" | "sidebar";
    isPrimary?: boolean;
    omega1: Vec2;
    omega2: Vec2;
    tau: Vec2;
    renderMode: RenderMode;
    halo: number;
    tileSize: number;
    terms: number;
    viewMode: ViewMode;
    showGrid: boolean;
    showLattice: boolean;
    showCell: boolean;
    showOmega: boolean;
    showSpecialPoints: boolean;
    showHalo: boolean;
    expr: string;
    exprStatus: "ok" | "error";
    exprError: string;
    exprGlslBody: string;
    onExprChange: (expr: string) => void;
    tileUpdatesPerSec?: number;
    colorMode: ColorMode;
    g2?: number;
    g3?: number;
    onBasisChange?: (omega1: Vec2, omega2: Vec2) => void;
  } = $props();

  // ── Scale controls ──────────────────────────────────────────────────
  let scaleValue = $derived(getScale(omega1));
  let logScale = $derived(Math.log2(scaleValue));
  let angleValue = $derived(Math.atan2(omega1.y, omega1.x));
  let angleDegrees = $derived((angleValue * 180) / Math.PI);

  function onScaleSlider(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    const newScale = Math.pow(2, v);
    const currentScale = getScale(omega1);
    if (currentScale < 1e-12) return;
    const factor = newScale / currentScale;
    const scaled = scaleLattice(omega1, omega2, factor);
    onBasisChange?.(scaled.omega1, scaled.omega2);
  }

  function resetScale() {
    const normalized = normalizeLattice(omega1, omega2);
    onBasisChange?.(normalized.omega1, normalized.omega2);
  }

  function onAngleSlider(e: Event) {
    const deg = parseFloat((e.target as HTMLInputElement).value);
    const angle = (deg * Math.PI) / 180;
    const basis = basisFromTau(tauFromBasis(omega1, omega2), getScale(omega1), angle);
    onBasisChange?.(basis.omega1, basis.omega2);
  }

  function resetAngle() {
    const basis = basisFromTau(tauFromBasis(omega1, omega2), getScale(omega1), 0);
    onBasisChange?.(basis.omega1, basis.omega2);
  }
</script>

{#if mode === "primary"}
  <!-- Primary mode: full-size viewport with overlay expression editor -->
  <div class="primary-viewport">
    <EllipticFunctionView
      {omega1}
      {omega2}
      {onBasisChange}
      {tau}
      mode={renderMode}
      {halo}
      {tileSize}
      {terms}
      bind:viewMode
      {showGrid}
      {showLattice}
      {showCell}
      {showOmega}
      {showSpecialPoints}
      {showHalo}
      bind:tileUpdatesPerSec={tileUpdatesPerSec}
      {exprGlslBody}
      {g2}
      {g3}
      showOverlay={false}
    />
    
    <!-- Overlay expression editor -->
    <ExpressionOverlay
      {expr}
      status={exprStatus}
      error={exprError}
      {onExprChange}
      bind:viewMode
    />
    
    <!-- Interaction hints -->
    <div class="hint">
      <span>drag ω₁ or ω₂ · pan background</span>
      <span>scroll to zoom · double-click to reset</span>
    </div>
  </div>
{:else}
  <!-- Sidebar mode: only show content when not promoted to primary -->
  {#if !isPrimary}
    <div class="sidebar-content">
      <!-- Mini elliptic function view -->
      <div class="ef-canvas-stack">
        <EllipticFunctionView
        {omega1}
        {omega2}
        {onBasisChange}
        {tau}
        mode={renderMode}
        {halo}
        {tileSize}
        {terms}
        bind:viewMode
        {showGrid}
        {showLattice}
        {showCell}
        {showOmega}
        {showSpecialPoints}
        {showHalo}
        tileUpdatesPerSec={tileUpdatesPerSec}
        {exprGlslBody}
        {expr}
        {g2}
        {g3}
        showOverlay={false}
      />
      </div>

      <!-- Expression and view controls -->
      <div class="section-body">
        <label class="expression-label">
          <div class="label-text">Expression</div>
          <div class="expression-group">
            <div class="expression-input-wrapper">
              <input
                type="text"
                class:error={exprStatus === "error"}
                value={expr}
                placeholder="e.g., wp, wpp^2 - 4*wp^3 + g2*wp + g3"
                oninput={(e) => onExprChange(e.currentTarget.value)}
              />
              {#if exprStatus === "error"}
                <div class="error-icon-inline" title={exprError}>⚠</div>
              {/if}
            </div>
            <div class="preset-menu-wrapper">
              <button
                class="preset-menu-button"
                title="Expression presets"
                onclick={() => (showPresetDropdown = !showPresetDropdown)}
              >
                ?
              </button>
              {#if showPresetDropdown}
                <div class="preset-dropdown">
                  <div class="preset-help">
                    <code>wp</code>, <code>wpp</code>, <code>g2</code>, <code>g3</code> · operators: <code>+ − * / ^</code>
                  </div>
                  {#each EXPR_PRESETS as preset}
                    <button
                      class="preset-option"
                      class:active={expr === preset.value}
                      onclick={() => {
                        onExprChange(preset.value);
                        showPresetDropdown = false;
                      }}
                    >
                      {preset.label}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          {#if exprStatus === "error"}
            <div class="error-message" title={exprError}>{exprError}</div>
          {/if}
        </label>

        <label class="view-mode-label">
          <div class="label-text">View</div>
          <div class="view-buttons">
            <button
              class="view-button"
              class:active={viewMode === "plane"}
              onclick={() => (viewMode = "plane")}
            >
              ℂ
            </button>
            <button
              class="view-button"
              class:active={viewMode === "torus"}
              onclick={() => (viewMode = "torus")}
            >
              ℂ/Λ
            </button>
          </div>
        </label>
      </div>
    </div>
  {/if}

  <!-- Scale controls: always visible in sidebar regardless of promotion -->
  <div class="scale-section">
    <div class="scale-header">
      <span>Scale (|ω₁|)</span>
      <button class="reset-scale-btn" onclick={resetScale} title="Normalize scale to |ω₁| = 1">|ω₁|=1</button>
      <span class="val">{scaleValue.toFixed(3)}</span>
    </div>
    <input
      type="range"
      min="-3" max="3" step="0.01"
      value={logScale}
      oninput={onScaleSlider}
    />
  </div>

  <div class="scale-section">
    <div class="scale-header">
      <span>Angle (arg ω₁)</span>
      <button class="reset-scale-btn" onclick={resetAngle} title="Reset angle to 0°">0°</button>
      <span class="val">{angleDegrees.toFixed(1)}°</span>
    </div>
    <input
      type="range"
      min="-180" max="180" step="0.1"
      value={angleDegrees}
      oninput={onAngleSlider}
    />
  </div>
{/if}

<style>
  .ef-canvas-stack {
    position: relative;
    aspect-ratio: 4/3;
    border: 1px solid rgba(255, 150, 60, 0.15);
    border-radius: 0.3rem;
    overflow: hidden;
    margin: 0.5rem 1rem 0.75rem;
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
  }

  .label-text {
    font-size: 0.78rem;
    color: rgba(255, 220, 180, 0.8);
  }

  .expression-label,
  .view-mode-label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: rgba(255, 220, 180, 0.8);
    font-size: 0.78rem;
  }

  .expression-group {
    display: flex;
    gap: 0.4rem;
    align-items: flex-start;
  }

  .expression-input-wrapper {
    flex: 1;
    position: relative;
  }

  .preset-menu-wrapper {
    position: relative;
  }

  .preset-menu-button {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.3);
    color: rgba(255, 200, 150, 0.7);
    width: 1.8rem;
    height: 1.8rem;
    padding: 0;
    border-radius: 0.2rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .preset-menu-button:hover {
    background: rgba(255, 150, 60, 0.1);
    border-color: rgba(255, 150, 60, 0.5);
    color: rgba(255, 220, 180, 0.9);
  }

  .preset-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    min-width: 260px;
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.25);
    border-radius: 0.3rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
  }

  .preset-help {
    padding: 0.5rem;
    font-size: 0.7rem;
    color: rgba(255, 180, 100, 0.6);
    border-bottom: 1px solid rgba(255, 150, 60, 0.12);
  }

  .preset-help code {
    background: rgba(255, 150, 60, 0.08);
    padding: 0.1rem 0.2rem;
    border-radius: 0.2rem;
    font-family: monospace;
    color: rgba(255, 200, 150, 0.8);
  }

  .preset-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.4rem 0.5rem;
    background: none;
    border: none;
    color: rgba(255, 200, 150, 0.7);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .preset-option:hover {
    background: rgba(255, 150, 60, 0.1);
    color: rgba(255, 220, 180, 0.9);
  }

  .preset-option.active {
    background: rgba(255, 150, 60, 0.15);
    color: rgba(255, 220, 180, 0.95);
    font-weight: 500;
  }

  input[type="text"] {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.2);
    color: rgba(255, 220, 180, 0.9);
    padding: 0.4rem 0.5rem;
    font-size: 0.75rem;
    font-family: monospace;
    border-radius: 0.2rem;
    transition: border-color 0.15s ease;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: rgba(255, 150, 60, 0.5);
  }

  input[type="text"].error {
    border-color: rgba(255, 100, 80, 0.6);
    background: rgba(255, 100, 80, 0.05);
  }

  .error-message {
    font-size: 0.7rem;
    color: rgba(255, 100, 80, 0.8);
    padding: 0.3rem;
  }

  .view-buttons {
    display: flex;
    gap: 0.3rem;
  }

  .view-button {
    flex: 1;
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.3);
    color: rgba(255, 200, 150, 0.7);
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 0.2rem;
    transition: all 0.15s ease;
  }

  .view-button:hover {
    background: rgba(255, 150, 60, 0.1);
    border-color: rgba(255, 150, 60, 0.5);
    color: rgba(255, 220, 180, 0.9);
  }

  .view-button.active {
    background: rgba(255, 150, 60, 0.15);
    border-color: rgba(255, 150, 60, 0.5);
    color: rgba(255, 220, 180, 0.9);
  }

  .scale-section {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.6rem 1rem 0.75rem;
    font-size: 0.72rem;
    color: rgba(255, 200, 150, 0.75);
  }

  .scale-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .scale-header span:first-child {
    flex: 1;
  }

  .reset-scale-btn {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.3);
    color: rgba(255, 200, 150, 0.7);
    padding: 0.15rem 0.4rem;
    font-size: 0.68rem;
    font-family: 'Courier New', monospace;
    cursor: pointer;
    border-radius: 0.2rem;
    transition: all 0.15s ease;
  }

  .reset-scale-btn:hover {
    background: rgba(255, 150, 60, 0.1);
    border-color: rgba(255, 150, 60, 0.5);
    color: rgba(255, 220, 180, 0.9);
  }

  .val {
    color: rgba(255, 220, 180, 1);
    font-family: monospace;
  }

  input[type="range"] {
    width: 100%;
    accent-color: rgba(255, 150, 60, 0.8);
    cursor: pointer;
  }

  .primary-viewport {
    position: relative;
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
