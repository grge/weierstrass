# Changelog

All notable changes to this project will be documented here.

---

## [Unreleased]

---

## 2026-04-03

### Changed
- **Pole/zero glow constants:** The six shader tunables (`poleThreshold`, `poleSoftness`, `poleStrength`, `zeroThreshold`, `zeroSoftness`, `zeroStrength`) were development levers with no UI controls. They are now GLSL constants in `tile.frag` at their tuned values. Removed from `RenderParams`, `GLResources`, `gl.ts` uniform plumbing, `Viewport.svelte` props, and `+page.svelte` state/URL encoding (~40 lines removed across 5 files).

## 2026-04-03

### Changed
- **Canonical τ policy (drag fix):** Replaced `canonicalizeBasis` snap in Viewport with a smooth `clampToPositiveDet` projection. When dragging an ω-handle would cause det(ω₁,ω₂) ≤ 0 (i.e. Im(τ) ≤ 0), the handle is now projected onto the det=ε boundary rather than jumping to the conjugate position, so the handle stays under the pointer.
- **TauPicker canvas:** Restricted to the upper half-plane only. Canvas is now 2:1 (200×100px), y-axis runs Im(τ) ∈ [0, 2.5]. Dragging is clamped to Im(τ) ≥ 0.05 by normalizeTau. Removed the decorative (1,0) reference dot.

## 2026-04-03

### Changed
- **GL robustness:** `createResources` now calls `gl.checkFramebufferStatus` after attaching the tile texture to the FBO and throws a descriptive error (with hex status code) if the framebuffer is incomplete. Previously a misconfigured or unsupported FBO would silently produce a black screen.

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
