/**
 * Canvas resize/DPR helper.
 *
 * Observes a container element with ResizeObserver and calls back with the
 * current CSS pixel dimensions whenever they change. The caller is responsible
 * for storing cssW/cssH as reactive state ($state) and resizing their canvases.
 *
 * Returns a cleanup function that disconnects the observer.
 *
 * Usage (inside onMount):
 *   const cleanup = observeSize(container, (w, h) => {
 *     cssW = w;
 *     cssH = h;
 *   });
 *   return cleanup;
 *
 * DPR helper:
 *   const dpr = getDevicePixelRatio();  // clamped to [1, 2]
 */
export function observeSize(
  container: Element,
  onChange: (cssW: number, cssH: number) => void,
): () => void {
  const ro = new ResizeObserver((entries) => {
    const e = entries[0];
    if (!e) return;
    onChange(e.contentRect.width, e.contentRect.height);
  });
  ro.observe(container);
  return () => ro.disconnect();
}

/** Returns the device pixel ratio, clamped to [1, 2]. */
export function getDevicePixelRatio(): number {
  return Math.min(typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1, 2);
}

/**
 * Resize a canvas to match a container's current size at device pixel ratio.
 * Returns [pixelW, pixelH] — the canvas dimensions in device pixels.
 * Safe to call every frame; only writes to canvas if size changed.
 */
export function resizeCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): [number, number] {
  const dpr = getDevicePixelRatio();
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return [w, h];
}
