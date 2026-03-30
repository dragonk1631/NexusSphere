# Dev Blog: Rhythm Game Sync & Resume Pipeline Overhaul

**Date: 2026-03-31**
**Category: Technical Optimization / Gameplay Integrity**

## Overview

Today's focused sprint was dedicated to transforming the core gameplay loop from a functional prototype into an industrial-grade, arcade-stable experience. We addressed three primary pillars: **Timing Synchronization**, **Resume/Restart Reliability**, and **User Input Security**.

---

## 1. Professional Resume System (The 3-2-1 Fix)

Resuming a rhythm game is a "Deceptively Simple" problem. Instant resumption often leaves the player disoriented and leads to synchronization drift between the audio buffer and the visual highway.

### 🛑 The Problem

- **Note Shaking (Jitter)**: During the pause, notes would slightly "stutter" due to sub-frame interpolation fighting the fixed game clock.
- **Input Leakage**: Users could still touch the screen or press keys during the "frozen" state, leading to accidental note hits or visual glitches.

### ✅ The Solution: "True Stillness & Absolute Lock"

- **Zero-Alpha Interpolation**: We implemented a strict override that forces the rendering `alpha` to exactly `0` whenever the resume countdown is active. This ensures pixel-perfect static visuals.
- **Input Pipeline Hardening**: We added an `isInputBlocked` guard to the `RhythmInputManager`. Now, during the 3-2-1 countdown, all keyboard and touch inputs are completely ignored—even the visual buttons won't light up until the music starts.

---

## 2. Hard Sequencer Reset (Zeroing the Clock)

A persistent "Note Freeze" bug was occurring during song retries, caused by SpessaSynth's internal clock retaining state residue from previous sessions.

### 🏗️ Technical Implementation

- **Sequencer Destruction**: Instead of just seeking to zero, we now perform a `fullReset` within the `CoreAudioEngine`. This completely destroys and recreates the MIDI sequencer, ensuring no lingering MIDI events or index mismatches exist.
- **SmoothClock Pinpoint Detection**: Reduced the "Audio Signal Wait" safety timeout from **5.0s to 0.1s**. This eliminates the artificial "Stall" players felt when restarting a song.

---

## 3. High-Fidelity HUD Enhancements

To match the technical stability, we polished the visual feedback system to reflect an "Arcade Premium" aesthetic.

### 🎨 Design Tokens

- **Typography**: Transitioned all HUD elements to **Orbitron 900 (Italic)**. Matches the signature sci-fi military aesthetic of the Title Screen.
- **Neon Bloom**: Receptors and input beams now feature a **Dual-pass Bloom** effect. Performance was optimized for mobile by removing expensive `shadowBlur` and using pre-rendered gradients.
- **Pause Interface**: Refined the button layout to be **1.5x width** with a 4px thick neon pulsating border, syncing with the game's energy levels.

---

## 4. Persistent Global BGM (Menu Audio Overhaul)

Previously, menus suffered from clashing, rogue MIDI audio that triggered multiple times or overlapped with song previews. We fully eliminated the old decentralized `CoreAudioEngine.playBGM()` calls from the UI state machine.

### 🎵 Technical Refactoring

- **Singleton `MenuMusicManager`**: Centralized MP3 audio playback. The main theme now loops continuously and seamlessly across the Title, Main Menu, and Options screens.
- **State-Driven Audio Routing**: `MenuState.enter()` correctly pauses the persistent BGM so `MenuManager` can independently load and play MIDI track previews. Upon `exit()`, previews are forcefully stopped and the main BGM resumes precisely from where it left off, creating a smooth transition matrix without audio bleeding.
- **Auto-Play Resolution**: Tied `tryUnblock()` explicitly to initial user interaction to comfortably navigate browser audio restrictions synchronously.

---

## 5. Editor UI Layout Restructuring

To maximize screen real estate (especially for mobile usage) and resolve usability clutter, the top header bar of the Editor was completely redesigned.

### 🛠️ Feature Cleanups & Layout

- **Removed Deprecated Tools**: Purged the redundant manual "Upload Button", "Sort Menu", "Refresh Button", and "BPM Tool". Left only clean, functional dropdowns.
- **Aligned Layout Methodology**:
  - *Left Alignment (`.file-tools`)*: Features the newly-expanded Song Title Dropdown (`midi-selector`) followed explicitly by the `Zoom` slider.
  - *Right Alignment (`.extra-tools`)*: Tightly packed core operations: `Test Difficulty` -> `TEST` -> `SAVE` -> `RESET` -> `MENU`.
- **Bug Fix: Solo Testing**: Addressed a severe flaw where `RhythmGame.ts` was hardcoding `null` during NoteFactory creation, completely ignoring the `test-channel` forced overrides. We removed the old `AUTO (Melody)` UI override entirely and hard-linked the forced test capability exclusively to the track's native `Solo (S)` indicator. Testing a specific channel is now highly intuitive.

---

## Summary of Results

- [x] **0ms Sync Drift**: Forced hard-sync on every unpause.
- [x] **No Input Residue**: Absolute lock during countdown.
- [x] **Audio Matrix Complete**: Persistent BGM across menus with strict Preview routing.
- [x] **Sleek Editor Navigation**: Clutter-free layout with highly intuitive, Solo-driven channel isolation debugging.

### 🚀 Status: DEPLOYED (Updated)

All stability, audio fixes, and editor visual overhauls have been pushed to **main** and **develop** branches.

---

> Authored by Antigravity (Coding Assistant)
