---
title: "Charting Logic Evolution and Gap-Filling Mechanics"
date: 2026-02-20
author: AI Assistant
tags: [chart-generation, melody-analyzer, gap-fill, design, bugfix]
---

This development log covers the major overhaul to NexusSphere's note charting algorithms that took place between February 19th and 20th, 2026. The primary focus was transitioning from a rudimentary single-track read system to an intelligent, multi-layered gap-filling engine that creates continuous, engaging rhythm gameplay from any complex MIDI file.

## 🧠 The Gap-Fill Charting Philosophy

**The Problem:**
Initially, the game relied purely on the single "best" channel identified by the `MelodyAnalyzer`. While this works well for pop songs with relentless vocal lines, it completely falls apart for jazz, classical, or progressive rock. When the main melody rests for several measures (e.g., during a guitar solo or a drum break), the player was left staring at an empty, boring screen.

**The Solution:**
We implemented a hierarchical fallback system. The `MelodyAnalyzer` was upgraded to return a full ranked list of channels (Top Melody -> Secondary Melodies -> Rhythm/Chords -> Drums) rather than just a single winner.

The `NoteFactory.ts` generation loop was rewritten to follow this intelligent "Gap Filling" logic:

1. **Primary Pass:** Create notes for every event in the #1 Main Channel.
2. **Secondary Pass:** Look at the #2 Channel. If there is a "gap" (rest) in the main channel, insert notes from the #2 channel to fill the dead air.
3. **Tertiary Pass:** If both #1 and #2 are silent, pull notes from the #3 channel.
4. **Drum Fallback:** If the entire melodic section of the band stops playing (e.g., a pure drum solo break), the game seamlessly switches to pulling beats from the Drum (Ch 10) track, ensuring the player always has something to hit.

To prevent messy visual overlap, we introduced **Duration-Aware Collision Detection**, meaning fallback notes are never spliced into the middle of a long sustained note from the primary track.

## 🔧 Fixing Chart Discrepancies (Editor vs. Main Game)

**The Problem:**
Playtesters noticed that a song charted slightly differently when played through the Editor's "Test" button compared to selecting that exact same song from the Main Menu.

**The Investigation:**
The discrepancy stemmed from isolated generation pipelines. The Editor was piping unquantized, high-level configurations directly into the engine, whereas the Main Game Mode was applying hard-coded difficulty multipliers (e.g., cutting note density on 'Normal' vs 'Hard') and quantization rules before generating the highway.

**The Solution:**

- Unified the `NoteFactory.generateMap()` entry points so that both modes share the exact same configuration payload.
- Forced the Editor's test mode to respect the globally selected "Difficulty" and "Quantization Level" variables, guaranteeing that what the mapmaker sees in the Editor is 100% identical to the final product players experience on the main screen.
