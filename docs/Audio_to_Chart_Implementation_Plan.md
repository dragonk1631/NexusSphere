# [MP3 to MIDI Chart] Implementation Plan (v2.1 - Fidelity Pass)

This document outlines the high-fidelity technical architecture for integrating MP3 playback into NexusSphere, utilizing state-of-the-art neural vocal transcription and granular melodic refinement.

---

## 🎯 Project Goals

- **Neural Accuracy**: Achieve 90%+ transcription accuracy using deep learning (HTDemucs + Basic-Pitch).
- **Zero-Latency Sync**: Maintain perfect alignment between audio onsets and MIDI notes (error margin < 10ms).
- **Melodic Fidelity**: Capture rapid melodic changes (staccato, legato) while stabilizing vibrato jitter.
- **Unified Logic**: Match the generated MIDI to the engine's existing 16-channel General MIDI standard for seamless chart generation.

---

## 🏗️ Core Strategy: "Neural Extraction & Refinement"

The system follows a three-stage pre-processing pipeline to convert raw MP3 audio into high-fidelity rhythm charts.

### 1. High-Fidelity Source Separation (HTDemucs v4)
- **Isolation**: Use `HTDemucs` (Hybrid Transformer) to isolate the **Vocal Stem** with minimal bleed from other instruments.
- **Configuration**: Run with `shifts=2` to optimize for zero-artifact melodic extraction.

### 2. Neural Pitch Inference (Spotify Basic-Pitch)
- **Engine**: Leverage the `Basic-Pitch` neural network for monophonic pitch detection from the isolated vocal tract.
- **Precision Tuning**: 
    - `onset_threshold=0.48`: High sensitivity for capturing breathy or soft starts.
    - `frame_threshold=0.35`: Balanced frame-level confidence for stability.

### 3. Fidelity & Sync Refinement (VocalFidelityRefiner)
To bridge the gap between AI raw data and gameplay-ready charts, we apply a specialized refinement layer:
- **Sync Correction (-250ms)**: Subtracts a global 250ms offset to compensate for inference window latency, ensuring perfect "beat-match."
- **Energy-Ratio Gating**: Compares isolated vocal energy against the original back-track. If the vocal ratio is $< 11\%$, it is treated as instrumental silence to prevent false positives (bleed notes).
- **Vibrato-Aware Modal Pitch**:
    - **Stability Rule**: If a pitch change ($\pm 1$ semitone) persists for $> 120ms$, it is preserved as a **New Note**.
    - **Smoothing**: Rapid jitters (vibrato) $< 120ms$ are merged into stable phrases to avoid MIDI "flickering."

---

## 🛠️ Technical Requirements

### 1. Processing Stack
- **Python 3.10+**: `librosa`, `torch==2.1.0+cu118`, `torchaudio`.
- **Pre-Process**: Handled by `scripts/analyze_beats.py` (Analysis) and `scripts/convert_mp3_to_midi.mjs` (MIDI Generation).

### 2. Output Format
- **Channel 1**: Refined Melodic Lead (Vocals).
- **Channel 10**: HPSS-derived Percussive Onsets (Drums).
- **Resolution**: High-precision JSON intermediate, quantized to MIDI for engine compatibility.

---

## 🏁 Verification Benchmarks

1.  **Sync Accuracy**: Verified via `check_sync.py`. Target error: **< 10ms**.
2.  **Melodic Density**: Verified by note count analysis on fast songs (e.g., "想いは廻る"). Target: Retention of 16th-note runs without over-smoothing.
3.  **Silence Precision**: Zero notes generated in instrumental breaks or intros (verified via energy-ratio logs).

---

*Nexus Sphere Development Team - Revised 2026-04-09*
