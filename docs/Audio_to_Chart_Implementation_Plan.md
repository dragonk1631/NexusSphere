# [MP3 to MIDI Chart] Implementation Plan (v2.0)

This document outlines the technical architecture for integrating MP3 playback into NexusSphere by leveraging the existing, well-established MIDI chart generation system.

---

## 🎯 Project Goals

- **Unified Logic**: Reuse the current MIDI-based chart generation logic without modification.
- **High Fidelity**: Provide a premium audio experience using MP3 files while maintaining the rhythmic precision of MIDI data.
- **Independent Conversion**: Implement a robust MP3-to-MIDI conversion pipeline that operates independently of the game's core engine.
- **Additive Integration**: Extend the current system to support MP3-based gameplay as a new feature, ensuring zero impact on the existing MIDI-only workflow.

---

## 🏗️ Core Strategy: "Conversion-First"

The central idea is to treat MP3 files as a source for MIDI generation. By converting an MP3 into a standard MIDI format, we can feed it directly into our proven chart generation logic.

### 1. Independent MP3-to-MIDI Converter
- **Input**: MP3 Audio File.
- **Logic**: Use AI-driven or signal-processing techniques to extract musical information (onsets, pitch, rhythm).
- **Output**: A standard MIDI file with:
    - **16 Channels**: Adhering to General MIDI (GM) standards.
    - **Instrument Separation**: Distinct tracks/channels for different instruments (Drums, Bass, Melody, etc.).
    - **Velocity & Duration**: Captured accurately to reflect the original audio's dynamics.

### 2. Unified Chart Generation
- **Zero Modification**: Use the existing `MidiParser` and `ChartGenerator` exactly as they are.
- **Channel Selection**: Apply the same channel-prioritization and metadata-extraction logic used for native MIDI files.
- **Difficulty Scaling**: Leverage the current algorithms to create different difficulty levels based on the generated MIDI data.

### 3. Synchronized Hybrid Playback
When a song is selected:
1. **Match Check**: Look for an MP3 file with the same name as the MIDI chart.
2. **Audio Source**: If found, use the MP3 as the primary audio output (BGM).
3. **Gameplay Clock**: Use the MP3's playback position to drive the note movement in the chart.
4. **Fallback**: If no MP3 is found, fall back to the built-in MIDI synthesizer for audio.

---

## 🛠️ Technical Requirements

### 1. MP3 Processing Layer
- Must produce a MIDI file that mimics a "well-composed" MIDI file.
- Should separate percussive elements (Channel 10) from melodic ones.
- Must ensure temporal synchronization (BPM and offset matching).

### 2. Audio Engine Updates
- Implement a `HybridAudioManager` that can switch between `WebAudio (MP3)` and `MidiSynth`.
- Ensure low-latency startup and seeking for MP3 playback.

---

## ⚠️ Implementation Principles (*Crucial*)

> [!IMPORTANT]
> **Do NOT modify existing MIDI chart generation logic.** The system is already stable and high-quality. Our goal is to make the MP3 source "look like" a standard MIDI to the engine.

- **Non-Destructive**: The MP3 pathway must be entirely additive.
- **Standardization**: The generated MIDI must follow the 16-channel format to remain compatible with all existing filters and selection logic.
- **Performance**: Heavy conversion (MP3 -> MIDI) should be handled as a pre-process step, not during game load if possible.

---

## 🏁 Verification Plan

1. **Format Validation**: Ensure the generated MIDI from an MP3 can be opened and played in any standard MIDI editor.
2. **Sync Test**: Verify that notes derived from the MP3 align perfectly with the audible peaks in the MP3 playback.
3. **Regression Test**: Confirm that original MIDI-only songs still function perfectly.

---

*Nexus Sphere Development Team - 2026-04-06*
