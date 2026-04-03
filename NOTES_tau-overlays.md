# Notes: τ-plane overlays — consistency with ℘ view

Date: 2026-04-03

## Context

The main viewport has six overlay toggles:
- Complex grid
- Cell lattice
- Fundamental cell
- Poles & zeros markers
- Pole & zero glow
- ω₁/ω₂ vectors

The τ picker currently shares only the complex grid toggle. This note
analyses what sharing means for each overlay, and what new τ-specific
overlays make sense.

---

## Per-overlay analysis

### ✅ Complex grid — already shared
Draws the integer grid in the current view's coordinate space.
In ℘ view: Re/Im axes. In τ view: same. Direct reuse of `showGrid`
works and is already implemented.

### ✅ ω vector / anchor toggle — simple, do this next
`showOmega` controls the ω₁/ω₂ handles in the main view. The τ
anchor is the exact analogue. The τ picker should respect `showOmega`
to hide/show the τ handle + vector line. One prop, three lines of
conditional drawing — trivial.

### ⚠️ Fundamental cell → Fundamental domain boundary
In the ℘ view: draws the parallelogram 0 → ω₁ → ω₁+ω₂ → ω₂.
In the τ view: the analogue is the **standard modular fundamental
domain boundary** — the arc |τ| = 1 from τ = e^{iπ/3} to
τ = e^{2iπ/3}, plus the vertical lines Re(τ) = ±½.

This is mathematically the right thing to show — it's the "cell" of
the modular group action, exactly as the parallelogram is the cell of
the lattice action. Not hard to draw: a circular arc + two line
segments.

However: the toggle should be a *different name* in UI terms. The
shared boolean could be called `showCell` (already the variable name),
but the UI label could say "Fundamental domain" in the τ section
rather than "Fundamental cell". Or just keep one toggle that changes
what it draws depending on context.

Implementation: ~20 lines of canvas drawing. No per-function logic
needed — the fundamental domain is the same for all modular functions.

**Verdict: implement, share `showCell` toggle, adapt drawing.**

### ⚠️ Cell lattice → Modular group tessellation
In the ℘ view: draws all translates of the fundamental cell — the
parallelogram lattice tiling the z-plane.
In the τ view: the analogue would be the **SL(2,Z) tessellation** —
all images of the fundamental domain under the modular group. This
produces the classic hyperbolic tiling of the upper half-plane.

This is significantly more complex. Computing the tessellation
requires iterating SL(2,Z) transformations and clipping each image
to the visible window. The number of tiles grows rapidly as Im(τ) → 0.
The standard approach is recursive: start from the fundamental domain,
apply T: τ→τ+1 and S: τ→-1/τ generators, check if result intersects
the visible rect, recurse.

Also: the curved boundaries (arcs) are non-trivial to draw correctly
— each image of the fundamental domain is bounded by arcs of circles.

**Verdict: interesting but complex. Defer. Note it as a future
enhancement in the modular notes file. Do not share `showLattice`
for this — it would be a separate toggle.**

### ⚠️ Poles & zeros markers — function-specific
In the ℘ view: marks the double pole at each lattice point and the
two zeros (found numerically via Newton).

In the τ view the zeros of each modular function are:
- **j(τ)**: zero of order 3 at τ = e^{iπ/3} = ρ (and its modular
  images). No poles in upper half-plane — only at the cusp i∞.
- **Δ(τ)**: non-vanishing in the upper half-plane entirely. Only
  zero at the cusp i∞ (not in our visible region).
- **E4(τ)**: zero of order 2 at τ = i (and modular images).
- **E6(τ)**: zero of order 3 at τ = ρ = e^{iπ/3} (and modular images).

The special points i and ρ are fixed and known analytically — no
numerical search needed. Their modular images lie outside the
fundamental domain by definition. So in the τ-plane view, "markers"
means: mark i and/or ρ if they're relevant for the current function,
and mark the cusp symbolically at the bottom edge.

This is different enough from the ℘ marker system that it warrants
its own toggle and drawing logic. The shared `showSpecialPoints` could
drive it, but the visual representation is entirely different.

**Verdict: implement as τ-specific special points overlay, sharing
`showSpecialPoints` toggle. Mark i and ρ as labelled points, always
visible regardless of function (they're always mathematically
significant). The cusp can be indicated with a fade/symbol at the
bottom edge.**

### ⚠️ Pole & zero glow — adapt in shader
In the ℘ view: shader brightens where log|w| is large (poles) and
darkens where -log|w| is large (zeros). Uses `u_halo` uniform.

In the τ view the same visual trick applies — domain colouring
already shows poles and zeros through hue discontinuities and
magnitude, but an explicit glow makes them pop. The glow shader code
is identical in structure. The difference is the magnitude scale:
j(τ) has dynamic range of ~10⁶ near the cusp, Δ is smoother.

The GLSL constants `POLE_THRESHOLD` etc. that we baked in for ℘
would need different values for modular functions, or should be
made adaptive based on the function. Alternatively, just share
`showHalo` and use a `u_halo` uniform in the modular shader with
function-appropriate constants per mode.

**Verdict: add `u_halo` uniform to modular shader, with per-function
constants. Share `showHalo` toggle. Medium effort, good payoff.**

---

## Proposed implementation order

1. **ω/anchor toggle** — share `showOmega`, hide τ handle when false.
   Trivial. Do this now.

2. **Fundamental domain boundary** — share `showCell`, draw the
   modular boundary arc + verticals in τ picker. ~20 lines.

3. **Special points (i and ρ)** — share `showSpecialPoints`, mark the
   two orbifold points with labelled circles. Fixed coordinates.

4. **Glow** — add `u_halo` to modular shader, share `showHalo`.
   Requires per-function threshold tuning.

5. **Modular tessellation** — future, separate toggle, significant
   complexity. Not worth doing until the pane architecture exists.

---

## UI naming

The Overlays section uses generic names ("Fundamental cell",
"Poles & zeros markers"). These are fine — they don't need to
become context-sensitive. Users will understand that "Fundamental
cell" means the relevant fundamental domain for whichever view
they're looking at.

The one exception: "Cell lattice" is specific to ℘ (it draws the
lattice tiling). If a modular tessellation is eventually added,
it should be a separate toggle rather than overloading this one.

---

## What is not worth sharing

- **Cell lattice** → modular tessellation is a distinct, complex
  feature. Keep separate.
- Any ℘-specific rendering options that don't have a clean modular
  analogue.
