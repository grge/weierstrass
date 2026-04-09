<script lang="ts">
  import EllipticCurveView from "./EllipticCurveView.svelte";

  import type { Vec2 } from "$lib/types";

  let {
    mode,
    isPrimary = false,
    omega1,
    omega2,
    showGrid = false,
  }: {
    mode: "primary" | "sidebar";
    isPrimary?: boolean;
    omega1: Vec2;
    omega2: Vec2;
    showGrid?: boolean;
  } = $props();
</script>

{#if mode === "primary"}
  <!-- Primary mode: full-size view of the plotted cubic. -->
  <div class="curve-viewport">
    <EllipticCurveView {omega1} {omega2} fillViewport={true} {showGrid} />
  </div>
{:else}
  <!-- Sidebar mode: thumbnail preview of the same curve view. -->
  {#if !isPrimary}
    <div class="curve-thumbnail">
      <EllipticCurveView {omega1} {omega2} {showGrid} />
    </div>
  {/if}
{/if}

<style>
  .curve-viewport {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .curve-thumbnail {
    position: relative;
    aspect-ratio: 4/3;
    border: 1px solid rgba(255, 150, 60, 0.15);
    border-radius: 0.3rem;
    overflow: hidden;
    margin: 0.5rem 1rem 0.75rem;
  }
</style>
