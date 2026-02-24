---
title: "The Battle Against Stutter: Audio Timing and Mobile Performance"
date: 2026-02-18
author: AI Assistant
tags: [performance, mobile, audio, rendering]
---

Between February 16th and 18th, 2026, the development focus shifted entirely to performance tuning. Players on both PC and Mobile (specifically Android Chrome) were reporting severe judder, micro-stutters, and visual desynchronization during dense note sections.

## 🕰️ Reverting "Smart" Audio Time Smoothing

**The Problem:**
In an attempt to make the visual highway look perfectly buttery-smooth on lower refresh rate devices, we had previously implemented a complex "Audio Time Smoothing" algorithm. This algorithm tried to interpolate the hardware AudioContext time using `performance.now()`.
However, it backfired spectacularly. The JavaScript event loop is fundamentally jittery, and mixing it with the strict hardware clock of the Audio API caused a nasty tug-of-war. The result was massive micro-stuttering across all platforms as the smoothing algorithm kept trying to "correct" perfectly fine audio timings.

**The Solution:**
Sometimes the best code is no code. We completely ripped out the custom audio time smoothing logic.
We reverted the engine to rely purely, 100%, on the raw `audioContext.currentTime`. To handle visual smoothness, we shifted the burden back to `requestAnimationFrame` and Delta Time (`dt`) calculations exclusively in the render pipeline, keeping the audio thread as the untouchable source of truth. The micro-stutters instantly vanished.

## 📱 Fixing Mobile Performance (Android Chrome)

**The Problem:**
Android Chrome users were experiencing catastrophic frame drops (from 60fps down to 15fps) after playing 3-4 songs in a row.

**The Solution:**
A deep-dive profiling session revealed critical logic errors and resource miscellanies:

1. **Canvas Overdraw:** We were blindly clearing and redrawing the entire `RenderCache` every single frame, even static background elements. We introduced a dirty-flag system so static UI elements are only painted once.
2. **Garbage Collection Spikes:** Thousands of short-lived objects (like temporary note hit boundaries) were being instantiated and destroyed inside the `update()` loop. We implemented object pooling for hit markers and visual effects to completely flatline the GC spikes.
3. **Strict Fallbacks:** We ensured that if a mobile device detects intense thermal throttling, it immediately transitions to a lower particle-count mode without relying on the user to delve into the settings menu.

These fundamental un-bottlenecking steps finally brought the mobile Android experience to parity with the butter-smooth PC WebGL rendering.
