# Weierstrass $\wp$

Interactive domain-colouring visualiser for the Weierstrass elliptic function, with modular function backgrounds on the $\tau$-plane.

**[Live demo →](https://grge.github.io/weierstrass/)**

---

## What it shows

### Elliptic function view (main canvas)
Domain colouring of user-defined elliptic function expressions across the complex plane. By default shows $\wp(z; \omega_1, \omega_2)$, but users can enter any expression using `wp`, `wpp` (the derivative), `g2`, `g3`, and operators `+ - * / ( ) ^k`.

Hue encodes the argument of the result, brightness encodes its magnitude. The lattice vectors $\omega_1$ and $\omega_2$ are draggable — reshaping them in real time updates the rendering and the $\tau$ display simultaneously.

Four colour modes: **Classic** (Wegert-style conformal rings), **Ember** (warm cosine palette), **Dusk** (pure phase portrait), **Contours** (magnitude/argument level sets).

Overlays: complex grid, cell lattice, fundamental cell outline, pole and zero markers (for the base ℘ function), pole/zero glow, $\omega$-vector handles. A torus view maps the fundamental cell directly, showing the expression as a function on $\mathbb{C}/\Lambda$.

### Elliptic curve view (sidebar panel)
Real algebraic curve $y^2 = 4x^3 - g_2 x - g_3$ associated with the current lattice. The curve coefficients $g_2$ and $g_3$ (Weierstrass invariants) are computed from the lattice basis and updated in real time as you reshape $\omega_1$ and $\omega_2$.

The panel displays:
- Both branches ($y = \pm\sqrt{\text{RHS}}$) of the curve, drawn with root-aware parametrization for smooth visual closure at the three branch points
- Root markers (orange circles) on the x-axis where the cubic vanishes
- Automatic viewport scaling that includes critical points of the cubic, ensuring the full curve character is visible (e.g., "bumps" in the 1-root case, the oval and unbounded tail in the 3-root case)
- Smooth camera animation as $\tau$ changes, using log-scale interpolation to avoid zoom artifacts

This view provides a complementary perspective: while the main canvas shows the complex-plane behaviour of $\wp(z)$, the curve panel shows the algebraic relation that $(\wp(z), \wp'(z))$ satisfies on its base field.

### Modular background ($\tau$ picker)
The lattice-shape panel includes optional domain colouring of classical modular functions on the upper half-plane $\mathbb{H} = \{\tau : \mathrm{Im}(\tau) > 0\}$:

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

**Expression renderer (two-pass WebGL 2.0):**
- Pass 1 evaluates the user-defined expression for one fundamental cell to an offscreen texture
- Pass 2 tiles this texture across the visible screen by mapping world → lattice coordinates mod 1
- Expressions are compiled to GLSL at runtime; the default expression `wp` renders the Weierstrass function
- This architecture evaluates the lattice sum once per tile pixel rather than per screen pixel

**Modular renderer (single-pass WebGL):**
- Maps each fragment to $\tau = x + iy$ in the upper half-plane
- Evaluates the $q$-series directly in GLSL
- Fades near the real axis where $|q| \to 1$ and convergence degrades

**Expression compiler (JavaScript → GLSL):**
- Parser and AST builder validate syntax and allowed identifiers
- GLSL code generator converts expressions to optimized shader code
- Compilation happens on-demand when the user changes the expression
- Failed compilations are caught and reported inline; rendering continues with the previous expression

Shared GLSL: complex arithmetic helpers and all four colour palette functions live in `complex.glsl` and `colour.glsl`, imported by both renderers.

---

## Code Structure

```
src/lib/
  math.ts                    — wp, wp', Newton zero-finding, coordinate transforms
  lattice.ts                 — lattice arithmetic, τ↔basis conversion, canonicalization
  curve.ts                   — elliptic curve geometry: g₂/g₃ computation, cubic roots, real interval sampling
  gl.ts                      — WebGL 2.0 resource lifecycle, expression compilation, two-pass rendering
  modular_gl.ts              — single-pass modular function renderer
  types.ts                   — shared TypeScript types
  expression/
    ast.ts                   — expression AST node types
    parser.ts                — tokenizer and recursive descent parser
    codegen_glsl.ts          — AST → GLSL code generation
    compile.ts               — end-to-end compilation pipeline with error reporting
  shaders/
    quad.vert                — shared vertex shader
    tile_expr.frag           — expression evaluation + domain colouring (uses shared snippets)
    screen.frag              — tiling / torus mapping pass
    tau_modular.frag         — modular q-series evaluation (uses shared snippets)
    complex.glsl             — complex arithmetic helpers (shared)
    colour.glsl              — HSV, cosine palette, four colour modes (shared)

src/routes/
  +page.svelte               — application state, URL serialisation, expression compilation
  Viewport.svelte            — main canvas, pan/zoom/drag interaction, overlays
  ExpressionOverlay.svelte   — expression editor and view mode toggle
  Controls.svelte            — sidebar UI
  CurveView.svelte           — elliptic curve rendering with smooth camera animation
  TauPicker.svelte           — τ picker with modular background canvas
```

---

## Technology

- **SvelteKit** — Svelte 5 runes for reactive state
- **WebGL 2.0** — modern browser support, GLSL ES 3.0
- **TypeScript** — light typing, function signatures and tagged unions
- Expression compiler — parser, AST, and GLSL code generation
- No external math or rendering libraries

---

## Building

```sh
npm install
npm run dev      # dev server at localhost:5173
npm run build    # static site output to ./build
npm run preview  # preview production build
```
