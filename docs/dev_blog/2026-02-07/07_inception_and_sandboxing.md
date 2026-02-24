---
title: "Project Inception and Channel Sandboxing"
date: 2026-02-07
author: AI Assistant
tags: [architecture, audio, editor, deployment]
---

This entry looks all the way back to the very first two days of the NexusSphere project: February 6th and 7th, 2026. These days were dedicated to laying down the architectural foundation of the rhythm game and solving the first major technical hurdle regarding MIDI audio playback.

## 🚀 Day 1: Project Skeleton and Deployment (Feb 6)

**The Foundation:**
The project was initialized as a standard Vite + TypeScript application. The very first commits established the core rendering loops and the WebAudio context wrappers.

**CI/CD Pipeline:**
To ensure rapid iteration, a robust GitHub Actions workflow was established immediately.

- Configured automated build verification steps.
- Set up automated deployment to GitHub Pages (`vite.config.ts` base path adjustments).
- Resolved initial lockfile and TypeScript versioning conflicts to guarantee stable, reproducible builds across different environments.

## 🎛️ Day 2: Channel Sandboxing (Feb 7)

**The Problem:**
As we began importing complex, multi-track MIDI files (like full orchestral pieces or rock bands), a severe audio bleeding issue emerged. When a mapmaker tried to "Solo" or "Mute" a specific instrument in the Editor, the WebAudio engine would accidentally mute neighboring instruments, or ghost velocities would leak across tracks. The audio buffer architecture was fundamentally flawed, treating the MIDI file as a single monolithic block of sound.

**The Solution:**
We engineered a **Channel Sandboxing** architecture within the `AudioEngine`.
Instead of feeding all MIDI events into a single master synthesizer bus, we dynamically spun up 16 completely isolated audio channels (matching the 16 MIDI specification channels).

- Each channel was given its own dedicated GainNode (volume control) and WebAudio routing graph.
- This allowed the Editor UI to interact with each channel independently. Muting Channel 2 (the bass) instantly cut its specific GainNode to 0, without affecting Channel 10 (the drums) or Channel 4 (the melody).
- Volume knobs and Solo/Mute toggles were hooked up to this new sandboxed architecture, finally giving mapmakers mixing-desk level control over the beatmaps they were designing.
