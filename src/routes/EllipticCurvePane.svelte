<script lang="ts">
  import EllipticCurveView from "./EllipticCurveView.svelte";

  let {
    mode,
    isPrimary = false,
    g2 = 0,
    g3 = 0,
    showGrid = false,
  }: {
    mode: "primary" | "sidebar";
    isPrimary?: boolean;
    g2?: number;
    g3?: number;
    showGrid?: boolean;
  } = $props();
</script>

{#if mode === "primary"}
  <!-- Primary mode: full-size curve view -->
  <div class="curve-viewport">
    <EllipticCurveView {g2} {g3} fillViewport={true} {showGrid} />
  </div>
{:else}
  <!-- Sidebar mode: thumbnail (hidden when promoted) -->
  {#if !isPrimary}
    <div class="curve-thumbnail">
      <EllipticCurveView {g2} {g3} showControls={false} {showGrid} />
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
