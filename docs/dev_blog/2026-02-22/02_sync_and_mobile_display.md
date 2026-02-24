---
title: "Audio Synchronization and Mobile Display Fixes"
date: 2026-02-22
author: AI Assistant
tags: [bugfix, audio-sync, mobile, ui, song-list]
---

This entry covers a series of critical bug fixes rolled out between February 21st and 22nd, 2026, focusing on cross-platform display issues, UI sorting, and audio-visual synchronization in the main game mode.

## 🕒 Main Mode Sync Fix (Pre-Game Timer)

**The Problem:**
Players noticed that in the main game mode, the first few notes of a song would either appear completely out of sync or be missed entirely immediately upon starting the level. However, this issue was absent when playtesting via the Editor mode.

**The Investigation:**
The discrepancy arose from how the `preGameTimer` (the 3-second lead-in countdown before a song starts) was handled. In the Editor's test mode, the audio context unlocking and the timer sequence were properly queued. In the main game mode, the audio playback was triggering prematurely before the visual note highway had finished its lead-in animation, causing an immediate desync.

**The Solution:**

- Unified the `shouldAutoStart`, `isTestMode`, and `start()` method logic.
- Ensured the AudioContext unlock event strictly halts audio playback until the visual `preGameTimer` reaches zero, perfectly aligning the first visual beat with the first audio tick in both Editor and Main Play modes.

## 📱 Fixing Mobile Display (Judgment Line Cutoff)

**The Problem:**
On mobile devices, the bottom of the screen was being cut off, causing the Judgment Line (the core hit zone) to render partially off-screen or become completely unplayable due to touch targets shifting downwards beneath the physical screen bezel.

**The Solution:**
We adjusted the core rendering loop and Canvas absolute positioning to respect safe-area insets and viewport height (`vh`) limitations on mobile browsers (specifically addressing the iOS Safari and Android Chrome URL bar collapsing behavior).
The rendering perspective logic was dynamically scaled so the game's hit zone is always fully anchored above the bottom bounding box, ensuring 100% visibility and touch accuracy across all mobile shapes.

## 🗂️ Song List Sorting Implementation

**The Feature:**
Previously, the song selection menu displayed tracks in a static, arbitrary order. As the `midi_list.json` grew, navigation became tedious.

**The Solution:**
We implemented a dynamic sorting system available in both Main and Editor modes:

1. Added a UI dropdown for Sort Criteria: **Name, BPM, Difficulty, and Note Count**.
2. Updated the metadata parsing script to ensure `midi_list.json` contained all required sorting fields.
3. Hooked the dropdown into the rendering pipeline so the list dynamically re-renders based on the chosen order without needing to reload the page or the song files.
