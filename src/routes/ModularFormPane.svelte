<script lang="ts">
  import ModularFormView from "./ModularFormView.svelte";
  import type { RenderMode } from "$lib/types";
  import type { Vec2 } from "$lib/types";

  let {
    mode,
    isPrimary = false,
    omega1 = $bindable(),
    omega2 = $bindable(),
    modularTileSize = $bindable(),
    modularTerms = $bindable(),
    modularForm = $bindable(),
    colorMode,
    showGrid,
  }: {
    mode: "primary" | "sidebar";
    isPrimary?: boolean;
    omega1: Vec2;
    omega2: Vec2;
    modularTileSize: number;
    modularTerms: number;
    modularForm: "j" | "delta" | "e4" | "e6";
    colorMode: RenderMode;
    showGrid: boolean;
  } = $props();

  // References to view instances for button actions
  let primaryViewInstance: ModularFormView | null = $state(null);
  let sidebarViewInstance: ModularFormView | null = $state(null);

  // Derived state for sidebar controls
  import { tauFromBasis } from "$lib/lattice";
  const tau = $derived(tauFromBasis(omega1, omega2));
  const tauLabel = $derived(`τ = ${tau.x.toFixed(3)} + ${tau.y.toFixed(3)}i`);
</script>

{#if mode === "primary"}
  <!-- Primary mode: full-size canvas with overlay controls (tau presets + background selector) -->
  <div class="modular-viewport">
    <ModularFormView
      bind:this={primaryViewInstance}
      bind:omega1
      bind:omega2
      bind:modularForm
      tauTileSize={modularTileSize}
      tauTerms={modularTerms}
      {colorMode}
      {showGrid}
      fillViewport={true}
    />

    <!-- In-canvas overlay: tau presets, generators, and modular function selector -->
    <div class="modular-overlay">
      <div class="overlay-pill">
        <div class="control-group">
          <label class="inline-label">
            Modular form
            <select bind:value={modularForm}>
              <option value="j">j(τ)</option>
              <option value="delta">Δ(τ)</option>
              <option value="e4">E₄(τ)</option>
              <option value="e6">E₆(τ)</option>
            </select>
          </label>
        </div>

        <div class="spacer"></div>

        <div class="control-group">
          <span class="tau-label">τ =</span>
          <button class="preset-btn" onclick={() => primaryViewInstance?.setSquare()} title="Square lattice (τ = i)">i</button>
          <button class="preset-btn" onclick={() => primaryViewInstance?.setHex()} title="Hexagonal lattice (τ = e^(iπ/3))">
            e<sup>iπ/3</sup>
          </button>
          <button class="preset-btn" onclick={() => primaryViewInstance?.applyT()} title="Apply T generator: τ ↦ τ + 1">
            τ+1
          </button>
          <button class="preset-btn" onclick={() => primaryViewInstance?.applyS()} title="Apply S generator: τ ↦ −1/τ">
            −1/τ
          </button>
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- Sidebar mode: only show content when not promoted to primary -->
  {#if !isPrimary}
    <div class="modular-sidebar">
      <div class="modular-thumbnail">
        <ModularFormView
          bind:this={sidebarViewInstance}
          bind:omega1
          bind:omega2
          bind:modularForm
          tauTileSize={modularTileSize}
          tauTerms={modularTerms}
          {colorMode}
          {showGrid}
          fillViewport={false}
        />
      </div>

      <!-- Sidebar controls -->
      <div class="sidebar-controls">
        <div class="tau-display">{tauLabel}</div>

        <label class="sidebar-label">
          <span>Modular form</span>
          <select bind:value={modularForm}>
            <option value="j">j(τ)</option>
            <option value="delta">Δ(τ)</option>
            <option value="e4">E4(τ)</option>
            <option value="e6">E6(τ)</option>
          </select>
        </label>

        <div class="preset-buttons">
          <span class="preset-label">τ =</span>
          <button class="sidebar-btn" title="Square lattice (τ = i)" onclick={() => sidebarViewInstance?.setSquare?.()}>i</button>
          <button class="sidebar-btn" title="Hexagonal lattice (τ = e^(iπ/3))" onclick={() => sidebarViewInstance?.setHex?.()}>e<sup>iπ/3</sup></button>
          <button class="sidebar-btn" title="Apply T generator: τ ↦ τ + 1" onclick={() => sidebarViewInstance?.applyT?.()}>τ + 1</button>
          <button class="sidebar-btn" title="Apply S generator: τ ↦ −1/τ" onclick={() => sidebarViewInstance?.applyS?.()}>−1/τ</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .modular-viewport {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .modular-overlay {
    position: absolute;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
  }

  .overlay-pill {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: rgba(18, 13, 11, 0.88);
    border: 1px solid rgba(255, 150, 60, 0.25);
    border-radius: 4px;
    padding: 0.5rem 1.25rem;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .preset-btn {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.35);
    color: rgba(255, 200, 150, 0.6);
    padding: 0 0.6rem;
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    height: 1.6rem;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preset-btn:hover {
    border-color: rgba(255, 150, 60, 0.5);
    background: rgba(255, 150, 60, 0.08);
    color: rgba(255, 220, 180, 0.8);
  }

  .tau-label {
    font-size: 0.75rem;
    color: rgba(255, 200, 150, 0.7);
    white-space: nowrap;
    padding-right: 2px;
  }

  .spacer {
    width: 1px;
    height: 1.8rem;
    background: rgba(255, 150, 60, 0.15);
  }

  .inline-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: rgba(255, 200, 150, 0.7);
    white-space: nowrap;
  }

  .inline-label select {
    background: rgba(30, 20, 15, 0.7);
    border: 1px solid rgba(255, 150, 60, 0.35);
    color: rgba(255, 220, 180, 0.9);
    padding: 0.2rem 0.4rem;
    font-size: 0.8rem;
    border-radius: 3px;
    height: 1.6rem;
    box-sizing: border-box;
    font-family: inherit;
  }

  sup {
    font-size: 0.6em;
  }



  .modular-sidebar {
    display: flex;
    flex-direction: column;
  }

  .modular-thumbnail {
    position: relative;
    aspect-ratio: 4/3;
    border: 1px solid rgba(255, 150, 60, 0.15);
    border-radius: 0.3rem;
    overflow: hidden;
    margin: 0.5rem 1rem 0.75rem;
  }

  .sidebar-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    margin-bottom: 0.9rem;
    padding: 0 1rem;
  }

  .tau-display {
    font-size: 0.72rem;
    font-family: monospace;
    color: rgba(255, 200, 150, 0.7);
    text-align: right;
  }

  .sidebar-label {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: rgba(255, 200, 150, 0.75);
  }

  .sidebar-label span {
    white-space: nowrap;
  }

  .sidebar-label select {
    background: #1a120f;
    border: 1px solid rgba(255, 150, 60, 0.3);
    color: rgba(255, 220, 180, 0.8);
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
    border-radius: 0.2rem;
    font-family: inherit;
  }

  .preset-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .preset-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: rgba(255, 200, 150, 0.75);
    white-space: nowrap;
    padding-right: 2px;
  }

  .sidebar-btn {
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
    font-family: inherit;
    min-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar-btn:hover {
    background: rgba(255, 150, 60, 0.1);
    border-color: rgba(255, 150, 60, 0.5);
    color: rgba(255, 220, 180, 0.9);
  }
</style>
