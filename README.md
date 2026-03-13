# Weierstrass ℘

Interactive visualisation of the Weierstrass elliptic function using domain colouring.

Live demo: https://grge.github.io/weierstrass/

## The Mathematics

The Weierstrass ℘-function is doubly periodic with respect to a lattice Λ = ℤω₁ + ℤω₂. It satisfies:

```
℘(z) = 1/z² + Σ [ 1/(z−w)² − 1/w² ]
```

where the sum runs over all non-zero lattice points w ∈ Λ. The function has a double pole at each lattice point and exactly two zeros in each fundamental cell.

The shape of the lattice is determined by τ = ω₂/ω₁, which must have Im(τ) > 0. Square lattices have τ = i, hexagonal lattices have τ = e^(iπ/3).

## Rendering Strategy

The visualisation uses a two-pass WebGL pipeline to avoid redundant computation.

**Pass 1 (Tile):** Compute ℘(z) for one fundamental cell (the unit square in lattice coordinates) and render it to a texture using domain colouring. The complex function value determines both hue (argument) and brightness (magnitude).

**Pass 2 (Screen):** In plane view, tile this texture across the visible portion of the complex plane by mapping world coordinates to lattice coordinates mod 1. In torus view, display the tile directly, showing the fundamental domain as a topological torus.

This approach evaluates ℘ exactly once per tile pixel rather than once per screen pixel, making interactive exploration feasible even with high term counts in the lattice sum.

## Zero Finding

The two zeros of ℘ in the fundamental cell are located using Newton's method. On the first frame, a coarse grid search finds an approximate zero. Subsequent frames use the previous zeros as initial guesses (warm start), allowing Newton's method to converge in just a few iterations. This makes dragging the lattice vectors smooth even though zero positions must be recomputed continuously.

## Code Structure

The codebase follows a functional style with minimal abstractions.

**math.ts** contains pure functions: complex arithmetic, the JavaScript implementation of ℘ and ℘', zero-finding via Newton iteration, and coordinate transformations between world space, screen space, and lattice coordinates.

**gl.ts** manages WebGL resource lifecycle. The `createResources` function allocates shaders, buffers, and textures. The `render` function executes the two-pass pipeline.

**Shaders:** `tile.frag` implements ℘ evaluation and four domain colouring modes (classic conformal rings, warm ember tones, gentle dusk phase portrait, and dark contour lines). The fragment shader computes the lattice sum directly in GLSL. `screen.frag` handles the tiling or direct display.

**Viewport.svelte** manages the canvas, user interaction (pan, zoom, dragging lattice vectors), and overlay drawing. The overlay is a separate 2D canvas layer that renders the lattice grid, fundamental cell outline, and pole/zero markers.

**Controls.svelte** and **TauPicker.svelte** provide the sidebar UI for adjusting lattice shape, visual parameters, and performance settings.

**+page.svelte** coordinates application state and synchronises it with URL parameters, allowing specific visualisations to be bookmarked and shared.

## Technology Choices

**SvelteKit** provides reactive state management with minimal boilerplate. Svelte 5 runes (`$state`, `$derived`, `$effect`) handle reactivity cleanly without a separate state management library.

**WebGL 1.0** is used for maximum browser compatibility. The tile texture approach works around the limitations of uniform arrays in WebGL 1.0 while maintaining good performance.

**TypeScript** with strict mode enabled catches type errors at compile time. The type system is used lightly—mostly for function signatures and a few tagged unions—rather than elaborate type hierarchies.

No external math libraries are used. Complex arithmetic and the Weierstrass function are implemented directly in about 150 lines of code.

## Building

```sh
npm install
npm run dev
```

For production:

```sh
npm run build
npm run preview
```

The build output is a static site that can be deployed anywhere.
