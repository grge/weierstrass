# Notes: Performance telemetry

Date: 2026-04-02 (revised 2026-04-03)

## What we built

Single metric in the Performance panel: **tile renders / second**.

This is the one number devtools won't give you easily. It measures how often
the GL tile render effect actually fires, which directly reveals whether
something is triggering unnecessary re-renders (the known architectural
concern with the combined GL+overlay effect).

## What we decided against

A fuller telemetry strip (frame ms, tile pass ms, FPS) was considered and
rejected. Frame time and tile pass time are available in browser devtools and
are less informative here than they look — CPU timing around `gl.drawArrays()`
is a proxy for GPU execution time, not a direct measure.

For regression checking, the honest approach is: drag an ω handle with
terms=10, glance at tile renders/s, compare before/after a change. No
infrastructure needed beyond what's already there.

## Optional future additions

- Expression compile time (ms) — once the expression compiler lands
- WebGL context loss count — low priority
