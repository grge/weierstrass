# Changelog

All notable changes to this project will be documented here.

---

## [Unreleased]

---

## 2026-04-03

### Changed
- **GL robustness:** `createResources` now calls `gl.checkFramebufferStatus` after attaching the tile texture to the FBO and throws a descriptive error (with hex status code) if the framebuffer is incomplete. Previously a misconfigured or unsupported FBO would silently produce a black screen.
- **Zero finder:** Newton-polish the inferred second zero (z₂ = −z₁ mod Λ) rather than using the raw fold result. Reduces floating-point drift for skewed or highly-scaled lattices.
- **Canonical τ policy:** Im(τ) is now enforced positive throughout. `normalizeTau` in TauPicker clamps to Im(τ) ≥ 0.05. `applyState` URL decoder enforces Im(τ) > 0. ω-handle drag uses `clampToPositiveDet` projection rather than a snap, so the handle stays under the pointer when approaching the real axis.
- **TauPicker canvas:** Restricted to the upper half-plane (2:1 aspect, Im(τ) ∈ [0, 2.5]). Removed the decorative (1,0) reference dot.
- **Removed "Flip Im(τ)" button** from TauPicker — no longer meaningful under the canonical upper-half-plane policy.
- **Pole/zero glow constants:** The six shader tunables (`poleThreshold`, `poleSoftness`, `poleStrength`, `zeroThreshold`, `zeroSoftness`, `zeroStrength`) had no UI controls. Now GLSL constants in `tile.frag`. Removed from `RenderParams`, `GLResources`, `gl.ts`, `Viewport.svelte`, and `+page.svelte`.
- **brightness/contrast constants:** `brightness=2.2` (Ember palette) is now a literal in `paletteEmber`. `contrast=1.0` produced a fixed `pow(color, 0.8)` gamma lift — inlined directly. Both removed from the full pipeline and URL encoding.
- **TauPicker UI polish:** Canvas resized to 4:3 (200×150px). τ label moved from canvas overlay to HTML below the canvas. Grid lines in TauPicker now conditional on the "Complex grid" overlay toggle. Modular background resolution slider in Performance section (1×–6×, default 2×). TauPicker now has an optional WebGL background showing domain colouring of modular functions on the upper half-plane. Selector: `None | j(τ) | Δ(τ) | E4(τ) | E6(τ)`. Rendered via a new single-pass WebGL renderer (`modular_gl.ts` + `tau_modular.frag`) using truncated q-series (E4, E6 → Δ → j). Shares colour palettes with the main ℘ renderer via the extracted GLSL snippets. Background tracks the active colour mode. Shared GLSL extracted from `tile.frag` into `complex.glsl` (complex arithmetic + PI) and `colour.glsl` (hsv2rgb, cosPalette, four palettes). `gl.ts` assembles shaders via `assembleShader()` which splices snippets at marker comments. Sets up clean reuse for the upcoming modular-τ renderer. `tileUpdatesPerSec` displayed in the Performance panel — counts how often the GL tile render effect actually fires per second. Useful for spotting unnecessary re-renders. Counter lives in Viewport, sampled every second via `setInterval`, passed to Controls as a prop. Code comment and README note explaining why GL and overlay drawing share a single Svelte effect, and when it would be worth splitting.

---

## 2026-03-13 — Initial production release

- First GitHub Pages deployment.
- Domain-colouring visualiser for the Weierstrass ℘-function.
- Interactive ω₁/ω₂ handle dragging, pan, and zoom.
- Four colour modes: Classic, Ember, Dusk, Contours.
- Torus view mode alongside complex-plane view.
- TauPicker with canvas drag, square/hexagonal presets, and scale slider.
- Overlay: complex grid, lattice grid, fundamental cell, poles/zeros, ω-vectors.
- URL state encoding for shareable views.
- WebGL tile-based rendering with configurable tile size and series terms.
