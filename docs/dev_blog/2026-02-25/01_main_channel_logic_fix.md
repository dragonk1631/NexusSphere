---
title: "Fixing the MAIN Channel Display Bias and UI Sync Issues"
date: 2026-02-25
author: AI Assistant
tags: [bugfix, editor, ui, audio-analysis]
---

## Overview

During the development of the NexusSphere beatmap editor, a persistent visual bug was identified where the "MAIN" channel badge in the track panel would frequently attach itself to nearly empty tracks (such as Channel 9), instead of the track containing the actual primary melody. This issue was particularly prominent in classical pieces like "Swan Lake" (which features a heavy, low-pitch melody on Channel 2).

This blog post documents the deep dive into the 3-layered root cause of this bug and the architectural improvements made to fix it.

---

## 🔍 Investigation & Troubleshooting

### 1. Timing Issue: The Initial Load Desync

**The Symptom:** When a MIDI file was loaded, the UI would occasionally render the wrong MAIN channel until the user manually hit the "RESET" button.
**The Cause:** In `EditorGame.ts -> loadMidi()`, the UI track layout (`updateTrackLayout`) was being rendered *before* the `MelodyAnalyzer` had finished building the initial `measureConfig` (gap-filling configuration). The UI was effectively drawing a blank or stale state.
**The Fix:** Adjusted the initialization pipeline. `aggregateChannelData()` and the `handleMagicAnalyze()` fallback were moved up to strictly execute *before* the UI render call.

### 2. Logic Issue: The Empty Measure Vulnerability

**The Symptom:** Extremely long sustained notes or large gaps in the song allowed empty channels to hijack the global MAIN channel vote.
**The Cause:** The previous scoring logic gave +1 point to whatever channel was "assigned" to a measure, regardless of whether that channel *actually played any notes* in that measure. Because the Gap-Fill AI often defaulted to Channel 9 for empty space, Channel 9 passively racked up hundreds of points from empty trailing measures without playing a single note.
**The Fix (Deprecated later):** Modified the tally to strictly count the *exact number of physical notes* played by the assigned channel in each measure. If a track was assigned but played 0 notes, it scored 0 points.

### 3. The Root Cause: MelodyAnalyzer's Anti-Bass Bias

**The Symptom:** Even with strict note-counting, "Swan Lake" still flagged Channel 9 as MAIN over Channel 2.
**The Cause:** The core `MelodyAnalyzer` ranks channels by giving a massive `+1500` point "First Principle" bonus to the track with the most notes. However, it had an old filter: `if (avgPitch < 45) -> treat as Bass background -> exclude from bonus`.
Because Swan Lake's melody is a low-pitch cello/bassoon (Pitch < 45), it was disqualified. Thus, Channel 9 (with only 6 random high-pitch notes) became the default winner of the "Most Notes" bonus by simply being the only eligible track left.
**The Fix:**

- Dropped the `isBass` pitch threshold from `45` to `35` (only filtering extreme sub-bass).
- Added a `c.noteCount > 20` gate to the First Principle bonus, ensuring that near-empty tracks can no longer steal the +1500 point reward.

---

## 🛠 Architectural Simplification

After discovering that `MelodyAnalyzer.findMelodyChannels()` already does an incredibly thorough job of ranking the true main melody (via pitch variance, entropy, name weighting, and polyphony ratios), we realized the custom, complex looping logic inside `EditorGame.ts` to calculate the MAIN badge was entirely redundant.

```typescript
// Old, flawed voting loop in EditorGame.ts (Removed)
// for (m = 0 to totalMeasures) { ... tally notes ... }

// New, unified logic (Added)
let bestMainChannel = -1;
if (this.midiData) {
    const rankedChannels = MelodyAnalyzer.findMelodyChannels(this.midiData);
    if (rankedChannels.length > 0) {
        bestMainChannel = rankedChannels[0]; // Directly ask the AI for the #1 rank
    }
}
```

## 🎉 Conclusion

By dismantling redundant UI tallying loops and fixing the AI's internal bias against low-pitch melodies, the editor now perfectly synchronizes the visual "MAIN" badge with the actual physical lead instrument, regardless of musical genre or empty gaps in the arrangement.
