# Dev Blog: Rhythm Editor Precision & Mobile Navigation Overhaul

**Date: 2026-04-01**
**Category: Technical Refinement / Mobile UX Stability**

## Overview

Today’s engineering sprint was focused on two critical areas: **Contextual Persistence** within the Rhythm Editor and **Absolute Navigation Reliability** on mobile devices. We successfully bridged the gap between the Editor and the Rhythm Game, ensuring that metadata is preserved across sessions and that "Hard Swaps" of the game engine no longer cause hangs or freezes.

---

## 1. Test Mode Data Integrity (HUD & Metadata)

Previously, the **Test Mode** within the editor felt disconnected from the track being edited. The HUD often displayed incorrect song titles and lengths derived from the default song library.

### 🛑 The Problem

- **Metadata Desync**: Testing a track in the editor would default the HUD info (Title/Duration) to the first song in the `midi_list.json`, providing poor feedback for duration-sensitive charting.
- **Context Loss**: Returning from a test session would reset the editor to the first song in the list, forcing users to manually re-navigate to their target track every single time.

### ✅ The Solution: "The Persistence Matrix"

- **Dynamic Metadata Gating**: Updated `RhythmGame.ts` to prioritize `midiData` (the actual buffer being tested) over the menu's selection. The HUD now accurately reflects the title and total duration of the MIDI currently in memory.
- **Transition Architecture Expansion**: Modified `GameTransition.ts` to include `midiUrl` and the current `songList`. 
- **Full Restoration Logic**: When returning to the editor, `EditorGame.ts` now checks for a valid restoration context. It re-populates the MIDI selector with the user’s specific list (including **local folders**) and re-highlights the exact song that was being tested.

---

## 2. Mobile Reliability: The "100ms Guard"

Navigation freezes are a common issue on mobile browsers when performing a "Hard Swap" of high-performance game logic (switching from Rhythm Game to Editor).

### 🏗️ Technical Implementation: Atomic Navigation

- **Navigation Guard (`isNavigating`)**: Implemented a strict boolean guard in `RhythmGame.ts`. This prevents race conditions where the song-end condition and a user's "Return" click might trigger the transition system simultaneously, leading to a deadlock.
- **De-coupled Event Dispatching**: Switched the `switch-game` event to an asynchronous dispatch using a **100ms safety delay**.
  - *Mechanism*: This delay ensures the mobile browser finishes its current, delicate animation frame and fully terminates the `Sequencer` and `AudioContext` jobs BEFORE the `EditorGame` logic attempts to initialize.
- **Diagnostic Logging**: Standardized internal navigation logs with `[Nav]` prefixes to provide clear visibility into state transitions on low-end mobile devices.

---

## 3. Visual Polish: Beat-Synced HUD

To wrap up the day, we refined the "active test" indicator to match the high-energy arcade aesthetic of the project.

### 🎨 Rhythmical UI

- **Beat-Synced Flicker**: The "TEST MODE ACTIVE" label is no longer a simple static pulsing text. We synchronized its `shadowBlur` and `globalAlpha` with the **musical beat (`beatPhase`)**. 
- **Effect**: The label now "flashes" precisely on the beat, mirroring the flickering receptors of the judgment line. This creates a cohesive, "alive" visual language that confirms the game is successfully synced to the music.

---

## Summary of Results

- [x] **Context Recovery**: Editor selection and list state (including folders) are perfectly preserved after a test play.
- [x] **Accurate HUD**: Song info in Test Mode reflects the actual MIDI data being tested.
- [x] **Rock-Solid Mobile Nav**: Zero freezes observed when exiting songs or returning to the editor on mobile.
- [x] **Rhythm-Aware UI**: Global pulse and beat-synced flickering for all Test Mode indicators.

### 🚀 Status: DEPLOYED

All context persistence logic, mobile stability guards, and HUD refinements have been pushed to **main** and **develop**.

---

> Authored by Antigravity (Coding Assistant)
