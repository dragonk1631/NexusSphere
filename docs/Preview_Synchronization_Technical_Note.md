# Technical Note: High-Precision Preview Synchronization

## 1. Problem Description

In the song selection menu, the visualizer (MIDI Channel EQ) frequently exhibited a delayed response compared to the audio preview.

- **Latency**: Even if audio started immediately, visual bars often stayed flat for several beats.
- **Inconsistency**: Certain songs reacted promptly, while others showed a massive lag.
- **Transition Glitches**: Switching songs quickly caused many "ghost" animations from previous tracks or frozen states.

## 2. Root Cause Analysis

### A. Non-Atomic State Transitions (Race Conditions)

The song preview sequence was asynchronous:

1. `fetch` MIDI Binary.
2. `parse` MIDI (updates `previewMidi` immediately).
3. `loadMidi` into Audio Engine (takes 100-500ms).
4. `play` audio.

Because the visualizer data (`previewMidi`) was updated in step 2, but the actual playback time (`playheadSec`) was still tied to the previous track's state or stuck at loading, the visualizer rendered a "mismatch" of new data at an old time, resulting in a dead zone at the start.

### B. MIDI Metadata Offsets

Many MIDI files do not start with a note at exactly 0.00s. They often contain 100-300ms of "header" operations (Volume, Pan, Instrument setup).

- When combined with hardware output latency compensation, the effective "visual time" starts in the negative range (e.g., `-0.1s`), making the bars appear dead even though the audio playback has technically begun.

### C. Hardware Output Latency

Digital audio has a delay between processing and the user's ears (typically 10-100ms). Without compensation, visuals appear "behind" the sound.

## 3. Implemented Solutions

### I. Output Latency Compensation

**Location**: `RhythmGame.ts`
Subtracted the audio engine's `getOutputLatency()` from the reported `previewTime`. This ensures the visualizer peaks at the exact moment sound reaches the user's hardware.

### II. Atomic State Switching

**Location**: `MenuManager.ts`
The `previewMidi` state is now updated **atomically** only after the audio engine reports that it is fully loaded and ready to play.

- This prevents the "beat late" effect during the asynchronous loading gap.

### III. First-Note Normalization (Anchor 0.0s)

**Location**: `MenuManager.ts`
Preview MIDI data is now pre-processed upon parsing.

- We find the timestamp of the very first audible note in the file.
- We shift all subsequent note timestamps by that offset, effectively "trimming" the leading silence.
- **Result**: The instant the play button is hit and audio emits, the first note triggers the visualizer immediately.

### IV. Aggressive Time Reset

**Location**: `CoreAudioEngine.ts`
Enforced `resetTimeState()` during every MIDI load to clear hardware clock anchors from previous tracks.

## 4. Conclusion

By combining hardware latency compensation, atomic state management, and MIDI data normalization, we have achieved a rock-solid preview experience. The synchronization is now imperceptible to the human eye, providing a premium, high-fidelity feeling to the song selection screen across all file types and devices.
