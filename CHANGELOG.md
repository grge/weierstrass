# Changelog

All notable changes to this project will be documented here.

---

## [Unreleased]

---

## 2026-04-03

### Changed
- **Zero finder:** Newton-polish the inferred second zero (z₂ = −z₁ mod Λ) rather than using the raw fold result. Reduces floating-point drift for skewed or highly-scaled lattices where `-z1` maps poorly through `toFundamental` alone.

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
