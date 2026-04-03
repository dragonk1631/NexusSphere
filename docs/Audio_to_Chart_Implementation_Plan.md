# [Audio to Chart] Implementation Plan: The Virtual MIDI Bridge (v1.0)

This document outlines the technical architecture for implementing a high-fidelity, MP3-based rhythm game experience in NexusSphere. The core philosophy is to treat audio as the absolute timing reference and use a "Virtual MIDI Bridge" to unify map generation between MIDI and Audio sources.

---

## 🎯 Project Goals

- **Perfect Sync**: Achieve frame-independent audio/note synchronization using the Web Audio API.
- **Unified Engine**: Reuse the existing, high-quality MIDI chart generation logic for MP3 sources.
- **AI-Driven Creativity**: Implement "Smart Classification" to distinguish instrument types and generate "fun," rhythmic patterns automatically.

---

## 🏗️ Technical Architecture

### 1. High-Precision Audio Sync Engine

- **Master Clock**: Use `audioContext.currentTime` as the single source of truth.
- **Lookahead Scheduler**: Implement a 100ms-window scheduler to pre-buffer Web Audio events, ensuring zero-jitter note playback, even during frame drops.
- **AudioBuffer Strategy**: Use `decodeAudioData` to load the entire MP3 into memory before play, avoiding the latencies and seeking issues of the `<audio>` tag.

### 2. The "Virtual MIDI Bridge"

Instead of building a separate generator for audio, we convert processed audio signals into an internal "Internal Event Stream" that mimics MIDI behavior.

- **Audio Analysis (Server/WASM)**: Perform FFT, Onset Detection, and Spectral Flux analysis to extract raw energy spikes.
- **Event Classification**: Sort onsets into specific categories:
  - **Kick**: Low-frequency transients (Map to MIDI Note 36).
  - **Snare**: Mid-high sharp decays (Map to MIDI Note 38).
  - **Cymbals/Hi-Hat**: High-frequency short transients (Map to MIDI Note 42).
  - **Melodic Lead**: Pitch-tracked vocal/instrument segments (Map to MIDI Note Range 60-72).
- **Virtual MIDI Generation**: Package these as a standard "Note Data" stream to be ingested by the `Universal Generator`.

### 3. Smart Chart Generation Pipeline (Pre-process)

- **Interpretation Layer**: A logic layer that decides the *intent* of a note (e.g., in a "Chorus" section, increase density by 1.5x; in a "Verse," only keep the 4/4 Kicks).
- **Soft Quantization**: Anchor notes to the grid using a weight-based snap, preserving the "Swing" or "Groove" of the original recording.
- **Pattern Templates**: Apply human-curated rhythmic "fun" templates (syncopation, polyrhythms) over the detected onsets.

---

## 🎮 User Experience & Calibration

### 1. Dual-Layer Offset System

To accommodate varying hardware and audio files, we divide offsets into two logical parts:
- **Global Latency Offset**: Adjusts for device-specific lag (e.g., Bluetooth headphones). Determined via a user-facing "Ping Test."
- **Song-Specific Offset**: Adjusts for silent intros or mastering differences in a specific MP3.

### 2. Auto-Analysis & Calibration UX

- **Drag-and-Drop**: Users drop an MP3 and optionally a MIDI file to start the process.
- **Visual Waveform Editor**: Allow users to manually adjust the `songOffset` by dragging the waveform relative to the grid.

---

## 🛠️ Implementation Phases

### Phase 1: Core Sync & Bridge (Foundational)

- [ ] Implement `WebAudioScheduler` class with Lookahead logic.
- [ ] Develop `AudioSignalProcessor` to extract basic Onsets (Kick/Snare).
- [ ] Create the `VirtualMidiBridge` to convert Onsets into the existing Game-Midi format.

### Phase 2: Refined Generation (Creative)

- [ ] Build the `Interpretation Layer` for density control (Verse/Chorus logic).
- [ ] Implement `Pattern Templates` for genre-specific hand-feel.
- [ ] Integrate the "Favorite" MIDI generation algorithm as the core engine.

---

## ⚠️ Potential Challenges & Solutions

- **Analysis Overhead**: Large MP3s can freeze the UI during FFT.
  - *Solution*: Offload audio processing to a `WebWorker` or `WASM` module.
- **Over-Crowded Charts**: Auto-gen can sometimes create too many notes.
  - *Solution*: Implement a "Density Limiter" that ensures a maximum Notes-Per-Second (NPS) based on the selected difficulty.

---

*Nexus Sphere Technical Design Team - 2026-04-03*
