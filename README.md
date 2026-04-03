# Weierstrass $\wp$

Interactive domain-colouring visualiser for the Weierstrass elliptic function, with modular function backgrounds on the $\tau$-plane.

**[Live demo →](https://grge.github.io/weierstrass/)**

---

## What it shows

### Elliptic function view (main canvas)
Domain colouring of $\wp(z; \omega_1, \omega_2)$ across the complex plane. Hue encodes the argument of $\wp(z)$, brightness encodes its magnitude. The lattice vectors $\omega_1$ and $\omega_2$ are draggable — reshaping them in real time updates the rendering, the pole/zero markers, and the $\tau$ display simultaneously.

Four colour modes: **Classic** (Wegert-style conformal rings), **Ember** (warm cosine palette), **Dusk** (pure phase portrait), **Contours** (magnitude/argument level sets).

Overlays: complex grid, cell lattice, fundamental cell outline, pole and zero markers, pole/zero glow, $\omega$-vector handles. A torus view maps the fundamental cell directly, showing $\wp$ as a function on $\mathbb{C}/\Lambda$.

### Modular background ($\tau$ picker)
The lattice-shape panel includes optional domain colouring of classical modular functions on the upper half-plane $\mathbb{H} = \{\tau : \operatorname{Im}(\tau) > 0\}$:

- $j(\tau)$ — the modular $j$-invariant, with characteristic fractal structure along the real axis
- $\Delta(\tau)$ — the Ramanujan discriminant form, non-vanishing on $\mathbb{H}$
- $E_4(\tau)$ — weight-4 Eisenstein series, zero of order 2 at $\tau = i$
- $E_6(\tau)$ — weight-6 Eisenstein series, zero of order 3 at $\tau = \rho = e^{i\pi/3}$

All four are computed from truncated $q$-series ($q = e^{2\pi i\tau}$) using Eisenstein series $E_4$ and $E_6$, with $\Delta$ and $j$ derived algebraically. The colour palette tracks the main view.

---

## The Mathematics

The Weierstrass $\wp$-function is defined by:

$$\wp(z) = \frac{1}{z^2} + \sum_{w \in \Lambda \setminus \{0\}} \left[ \frac{1}{(z-w)^2} - \frac{1}{w^2} \right]$$

where the sum runs over all non-zero lattice points $w \in \Lambda = \mathbb{Z}\omega_1 + \mathbb{Z}\omega_2$. It has a double pole at each lattice point and exactly two zeros per fundamental cell.

The shape of the lattice is governed by $\tau = \omega_2/\omega_1 \in \mathbb{H}$. Square lattices have $\tau = i$; hexagonal lattices have $\tau = e^{i\pi/3}$.

The modular functions are computed via $q$-series at $q = e^{2\pi i\tau}$:

$$E_4(\tau) = 1 + 240 \sum_{n \geq 1} \sigma_3(n)\, q^n$$

$$E_6(\tau) = 1 - 504 \sum_{n \geq 1} \sigma_5(n)\, q^n$$

$$\Delta(\tau) = \frac{E_4^3 - E_6^2}{1728}, \qquad j(\tau) = \frac{E_4^3}{\Delta}$$

---

## Rendering

**$\wp$ renderer (two-pass WebGL):**
- Pass 1 renders $\wp(z)$ for one fundamental cell to an offscreen texture
- Pass 2 tiles this texture across the visible screen by mapping world → lattice coordinates mod 1
- This evaluates the lattice sum once per tile pixel rather than per screen pixel

**Modular renderer (single-pass WebGL):**
- Maps each fragment to $\tau = x + iy$ in the upper half-plane
- Evaluates the $q$-series directly in GLSL
- Fades near the real axis where $|q| \to 1$ and convergence degrades

Shared GLSL: complex arithmetic helpers and all four colour palette functions live in `complex.glsl` and `colour.glsl`, imported by both renderers.

---

## Code Structure

```
src/lib/
  math.ts          — wp, wp', Newton zero-finding, coordinate transforms
  lattice.ts       — lattice arithmetic, τ↔basis conversion, canonicalization
  gl.ts            — WebGL resource lifecycle, two-pass wp renderer
  modular_gl.ts    — single-pass modular function renderer
  types.ts         — shared TypeScript types
  shaders/
    quad.vert      — shared vertex shader
    tile.frag      — wp evaluation + domain colouring (uses shared snippets)
    screen.frag    — tiling / torus mapping pass
    tau_modular.frag — modular q-series evaluation (uses shared snippets)
    complex.glsl   — complex arithmetic (shared)
    colour.glsl    — HSV, cosine palette, four colour modes (shared)

src/routes/
  +page.svelte     — application state, URL serialisation
  Viewport.svelte  — main canvas, pan/zoom/drag interaction, overlays
  Controls.svelte  — sidebar UI
  TauPicker.svelte — τ picker with modular background canvas
```

---

## Technology

- **SvelteKit** — Svelte 5 runes for reactive state
- **WebGL 1.0** — maximum browser compatibility
- **TypeScript** — light typing, function signatures and tagged unions
- No external math or rendering libraries

---

## Building

```sh
npm install
npm run dev      # dev server at localhost:5173
npm run build    # static site output to ./build
npm run preview  # preview production build
```
