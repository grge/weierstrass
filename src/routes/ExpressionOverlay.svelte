<script lang="ts">
  const PRESET_EXPRESSIONS = [
    "wp",
    "wpp",
    "wp^2 - 1/12",
    "wpp^2 - 4*wp^3 + g2*wp + g3",
    "wpp/(wp - 1)",
  ];

  let {
    expr = "wp",
    status = "ok",
    error = "",
    onExprChange = (e: string) => {},
    viewMode = $bindable("plane"),
  }: {
    expr: string;
    status: "ok" | "error";
    error: string;
    onExprChange: (expr: string) => void;
    viewMode?: "plane" | "torus";
  } = $props();

  let inputValue = $state("");
  let showDropdown = $state(false);
  let containerElement: HTMLDivElement;

  function applyExpression(newExpr: string) {
    inputValue = newExpr;
    onExprChange(newExpr);
    showDropdown = false;
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    inputValue = target.value;
    onExprChange(target.value);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      inputValue = expr;
      showDropdown = false;
    }
  }

  function handleClickOutside(e: PointerEvent) {
    if (containerElement && !containerElement.contains(e.target as Node)) {
      showDropdown = false;
    }
  }

  $effect.pre(() => {
    inputValue = expr;
  });

  $effect(() => {
    if (showDropdown) {
      document.addEventListener("pointerdown", handleClickOutside);
      return () => document.removeEventListener("pointerdown", handleClickOutside);
    }
  });
</script>

<div
  class="top-controls"
  bind:this={containerElement}
  onpointerdown={(e) => e.stopPropagation()}
  onwheel={(e) => e.stopPropagation()}
>
  <div class="control-group expression-group">
    <div class="expression-input-wrapper">
      <input
        type="text"
        class="expression-input"
        class:error={status === "error"}
        value={inputValue}
        onchange={handleInputChange}
        oninput={handleInputChange}
        onkeydown={handleKeyDown}
        placeholder="Enter expression..."
        aria-label="Expression input"
      />
      {#if status === "error"}
        <div class="error-icon-inline" title={error}>⚠</div>
      {/if}
    </div>
    <button
      class="preset-menu-button"
      onclick={() => (showDropdown = !showDropdown)}
      aria-label="Preset expressions"
      aria-expanded={showDropdown}
      title="Presets"
    >
      ?
    </button>

    {#if showDropdown}
      <div class="preset-dropdown">
        <div class="preset-help">
          Use <span class="code">wp</span> for ℘ and <span class="code">wpp</span> for ℘′. Operators: <span class="code">+ - * / ( ) ^k</span>
        </div>
        {#each PRESET_EXPRESSIONS as preset}
          <button
            class="preset-option"
            class:active={inputValue === preset}
            onclick={() => applyExpression(preset)}
          >
            {preset}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="spacer"></div>

  <div class="control-group view-group">
    <button
      class="view-button"
      class:active={viewMode === "plane"}
      onclick={() => (viewMode = "plane")}
      title="Complex plane view"
    >
      ℂ
    </button>
    <button
      class="view-button"
      class:active={viewMode === "torus"}
      onclick={() => (viewMode = "torus")}
      title="Torus view"
    >
      ℂ/Λ
    </button>
  </div>
</div>

<style>
  .top-controls {
    position: absolute;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    z-index: 5;
    pointer-events: auto;
    padding: 0.5rem 1.25rem;
    background: rgba(18, 13, 11, 0.88);
    border: 1px solid rgba(255, 150, 60, 0.25);
    border-radius: 4px;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .expression-group {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .view-group {
    display: flex;
    gap: 0.3rem;
  }

  .spacer {
    flex: 0 0 auto;
    width: 1px;
    height: 1.8rem;
    background: rgba(255, 150, 60, 0.15);
  }

  .expression-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .expression-input {
    padding: 0.4rem 0.6rem;
    border: 1px solid rgba(255, 150, 60, 0.35);
    background: rgba(30, 20, 15, 0.7);
    color: rgba(255, 220, 180, 0.95);
    border-radius: 3px;
    font-family: "Menlo", "Monaco", "Courier New", monospace;
    font-size: 0.8rem;
    width: 240px;
    height: 1.6rem;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .expression-input::placeholder {
    color: rgba(255, 180, 100, 0.35);
  }

  .expression-input:focus {
    outline: none;
    border-color: rgba(255, 150, 60, 0.6);
    background: rgba(30, 20, 15, 0.95);
    box-shadow: 0 0 0 2px rgba(255, 150, 60, 0.08);
  }

  .expression-input.error {
    border-color: rgba(255, 100, 100, 0.5);
    background: rgba(30, 18, 15, 0.88);
  }

  .expression-input.error:focus {
    box-shadow: 0 0 0 2px rgba(255, 100, 100, 0.08);
  }

  .error-icon-inline {
    position: absolute;
    right: 1em;
    color: rgba(255, 100, 100, 0.7);
    font-size: 0.9rem;
    cursor: default;
    pointer-events: auto;
  }

  .preset-menu-button {
    padding: 0 0.5rem;
    border: 1px solid rgba(255, 150, 60, 0.35);
    background: rgba(30, 20, 15, 0.7);
    color: rgba(255, 200, 150, 0.6);
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s ease;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    box-sizing: border-box;
  }

  .preset-menu-button:hover {
    border-color: rgba(255, 150, 60, 0.5);
    background: rgba(255, 150, 60, 0.08);
    color: rgba(255, 220, 180, 0.8);
  }

  .preset-dropdown {
    position: absolute;
    top: calc(100% + 0.3rem);
    left: 0;
    display: flex;
    flex-direction: column;
    background: rgba(18, 13, 11, 0.96);
    border: 1px solid rgba(255, 150, 60, 0.3);
    border-radius: 3px;
    min-width: 280px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    z-index: 1000;
    overflow: visible;
  }

  .preset-help {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid rgba(255, 150, 60, 0.2);
    color: rgba(255, 220, 180, 0.6);
    font-size: 0.7rem;
    line-height: 1.3;
  }

  .preset-help .code {
    font-family: "Menlo", "Monaco", "Courier New", monospace;
    color: rgba(255, 220, 180, 0.8);
    background: rgba(255, 150, 60, 0.08);
    padding: 0.1rem 0.25rem;
    border-radius: 2px;
  }

  .preset-option {
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: rgba(255, 220, 180, 0.7);
    text-align: left;
    cursor: pointer;
    font-family: "Menlo", "Monaco", "Courier New", monospace;
    font-size: 0.8rem;
    transition: background-color 0.1s ease, color 0.1s ease;
  }

  .preset-option:hover {
    background: rgba(255, 150, 60, 0.12);
    color: rgba(255, 220, 180, 0.95);
  }

  .preset-option.active {
    background: rgba(255, 150, 60, 0.2);
    color: rgba(255, 220, 180, 0.95);
  }

  .view-button {
    padding: 0 0.6rem;
    border: 1px solid rgba(255, 150, 60, 0.35);
    background: rgba(30, 20, 15, 0.7);
    color: rgba(255, 200, 150, 0.55);
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.15s ease;
    width: 2.8rem;
    height: 1.6rem;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .view-button:hover {
    border-color: rgba(255, 150, 60, 0.5);
    background: rgba(255, 150, 60, 0.08);
    color: rgba(255, 220, 180, 0.8);
  }

  .view-button.active {
    background: rgba(255, 150, 60, 0.18);
    border-color: rgba(255, 150, 60, 0.5);
    color: rgba(255, 220, 180, 0.95);
  }
</style>
