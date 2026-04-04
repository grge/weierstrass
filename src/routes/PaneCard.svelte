<script lang="ts">
  let {
    label,
    isPrimary = false,
    onPromote,
    children,
  }: {
    label: string;
    isPrimary?: boolean;
    onPromote?: () => void;
    children: any;
  } = $props();
</script>

<details open class:primary={isPrimary}>
  <summary>
    <span class="pane-label">{label}</span>
    <div
      class="led-hitarea"
      role="button"
      tabindex="0"
      title={isPrimary ? "In main view" : "Set as main view"}
      onclick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isPrimary && onPromote) onPromote(); }}
      onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); if (!isPrimary && onPromote) onPromote(); } }}
    >
      <div class="led" class:led-on={isPrimary}></div>
    </div>
  </summary>
  {@render children()}
</details>

<style>
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
    transition: background 0.25s ease, color 0.25s ease;
  }

  details.primary > summary {
    background: linear-gradient(90deg, rgba(255, 120, 30, 0.13) 0%, rgba(255, 120, 30, 0.03) 100%);
    color: rgba(255, 220, 180, 0.85);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: "›";
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

  .pane-label {
    flex: 1;
  }

  .led-hitarea {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    margin: -0.65rem -0.25rem;
    flex-shrink: 0;
    cursor: pointer;
  }

  .led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: rgba(180, 90, 30, 0.7);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 130, 50, 0.3);
    transition: background 0.2s ease, box-shadow 0.2s ease;
  }

  .led.led-on {
    background: rgba(255, 140, 40, 1);
    box-shadow:
      0 0 4px 1px rgba(255, 140, 40, 0.8),
      0 0 10px 2px rgba(255, 100, 20, 0.5),
      inset 0 1px 1px rgba(255, 220, 150, 0.4);
  }

  .led-hitarea:hover .led:not(.led-on) {
    background: rgba(210, 110, 40, 0.85);
    box-shadow:
      0 0 5px 1px rgba(255, 140, 40, 0.3),
      0 0 0 1px rgba(255, 130, 50, 0.45),
      inset 0 1px 2px rgba(0, 0, 0, 0.3);
  }
</style>
