/**
 * Generic RAF-based lerp animation loop.
 *
 * Owns the requestAnimationFrame lifecycle: starts, runs per-frame callbacks,
 * detects when the animation has settled, and stops. The caller provides the
 * per-frame step logic and the settled predicate.
 *
 * Usage:
 *   const loop = createLerpLoop({
 *     onFrame: () => { cam += (target - cam) * T; draw(); },
 *     isSettled: () => Math.abs(cam - target) < EPS,
 *     onSettle: () => { cam = target; draw(); },
 *   });
 *   loop.restart();   // call whenever target changes
 *   loop.destroy();   // call on component teardown
 */
export interface LerpLoopOptions {
  /** Called every frame. Should advance smoothed state toward target and render. */
  onFrame: () => void;
  /** Returns true when smoothed state is close enough to target to stop. */
  isSettled: () => boolean;
  /** Called once when settled, after the final snap. Should render the exact final state. */
  onSettle: () => void;
}

export interface LerpLoop {
  /** Start the loop if not already running. Safe to call repeatedly. */
  restart: () => void;
  /** Cancel the loop and release the RAF handle. Call on component teardown. */
  destroy: () => void;
}

export function createLerpLoop(options: LerpLoopOptions): LerpLoop {
  const { onFrame, isSettled, onSettle } = options;
  let rafId: number | null = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    onFrame();
    if (isSettled()) {
      cancelAnimationFrame(rafId);
      rafId = null;
      onSettle();
    }
  }

  return {
    restart() {
      if (rafId === null) rafId = requestAnimationFrame(frame);
    },
    destroy() {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    },
  };
}
