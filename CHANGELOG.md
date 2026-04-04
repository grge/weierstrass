# Changelog

All notable changes to this project will be documented here.

---

## [Unreleased]

### Added
- **Expression engine (M1):** Users can now enter arbitrary elliptic function expressions in a top-center editor. Supports identifiers (`wp`, `wpp`, `g2`, `g3`), operators (`+ - * / ( )`), and integer powers (`^k`). Expressions are compiled to GLSL and rendered in real time. Preset dropdown with example expressions. Parse errors shown inline with tooltip.
- **WebGL 2.0 migration:** Upgraded from WebGL 1.0 to WebGL 2.0 (GLSL ES 3.0) for modern syntax and bitwise operators (used for efficient expression evaluation).

### Changed
- **Unified tile shader:** Expression engine is now the primary rendering path. The default expression `wp` renders the standard Weierstrass function. No separate hardcoded mode; all rendering uses the same compilation pipeline.
- **Pole/zero markers temporarily disabled:** Calculating zeros of arbitrary expressions requires symbolic differentiation (deferred to M3+). Markers are disabled for now.

---

## 2026-04-03

### Added
- **Modular $\tau$ background:** TauPicker now has an optional WebGL background showing domain colouring of $j(\tau)$, $\Delta(\tau)$, $E_4(\tau)$, or $E_6(\tau)$ on the upper half-plane. Selector in the Lattice shape section. Computed from truncated q-series ($E_4$, $E_6$ → $\Delta$ → j) in GLSL, rendered via a new single-pass renderer (`modular_gl.ts` + `tau_modular.frag`). Colour palette tracks the main viewport mode.
- **Tile render counter:** `tileUpdatesPerSec` displayed in the Performance panel — counts how often the GL tile render effect fires per second. Useful for spotting unnecessary re-renders.

### Changed
- **Sidebar header:** Replaced the mismatched close/reset buttons with a proper header bar — app title "Weierstrass $\wp$", GitHub link, icon-button reset, and icon-button close. Consistent 1.8rem icon buttons throughout.
- **Shader snippets extracted:** Shared GLSL factored out of `tile.frag` into `complex.glsl` (complex arithmetic) and `colour.glsl` (four palette functions). Both renderers assemble their shaders via `assembleShader()` in `gl.ts`.
- **Performance controls renamed:** Consistent `wp_*` / `tau_*` prefix scheme across variable names, URL keys, and UI labels: `wp_tile`, `wp_terms`, `tau_tile`, `tau_terms`. Old URL keys `tile`/`terms` still accepted as fallbacks.
- **$\tau$ series terms slider:** New Performance slider (5–60, default 20) controls q-series truncation depth in the modular shader.
- **TauPicker overlay:** DPR-aware canvas rendering — handles and lines are crisp on retina displays. Overlay now matches the Viewport style: white grid/axes, white vector line, orange $\tau$ handle with label, hover glow. Grid conditional on the Complex grid overlay toggle.
- **TauPicker canvas:** Resized to 4:3 (200×150). $\tau$ value moved from canvas text to HTML label below.
- **Canonical $\tau$ policy:** Im($\tau$) enforced > 0 throughout. Dragging an ω-handle across the real axis uses a smooth `clampToPositiveDet` projection rather than flipping ω₂. TauPicker canvas restricted to upper half-plane. "Flip Im($\tau$)" button removed.
- **Consistency pass:** Unified font sizes (`0.78rem` labels, `0.75rem` monospace values, `0.70rem` section headers), section spacing (`0.75rem` gap), and select element styling across Controls and TauPicker.
- **Combined render pipeline documented:** Code comment and README note explaining the known architectural simplification (overlay-only toggles trigger a GPU re-render).

### Fixed
- **Open button invisible when sidebar collapsed:** The `{#if !sidebarOpen}` block was nested inside the `<aside>` element, which slides off-screen when closed. Moved outside so it always renders in the stage layer.
- **Modular resolution slider zoomed the view:** Setting canvas `width`/`height` reactively in HTML caused a timing mismatch with `gl.viewport()`. Fixed by setting pixel dimensions imperatively inside the render effect.

### Removed
- **Pole/zero glow tunables:** Six previously-tunable shader uniforms (`poleThreshold` etc.) had no UI controls. Replaced with GLSL constants in `tile.frag`.
- **brightness/contrast state:** Both were fixed at their default values with no UI. `brightness=2.2` inlined into `paletteEmber`; `contrast=1.0` produces a fixed `pow(color, 0.8)` gamma lift, also inlined.

---

## 2026-03-13 — Initial production release

- First GitHub Pages deployment.
- Domain-colouring visualiser for the Weierstrass $\wp$-function.
- Interactive ω₁/ω₂ handle dragging, pan, and zoom.
- Four colour modes: Classic, Ember, Dusk, Contours.
- Torus view mode alongside complex-plane view.
- TauPicker with canvas drag, square/hexagonal presets, and scale slider.
- Overlay: complex grid, lattice grid, fundamental cell, poles/zeros, ω-vectors.
- URL state encoding for shareable views.
- WebGL tile-based rendering with configurable tile size and series terms.
