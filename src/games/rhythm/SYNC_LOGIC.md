# Rhythm Game Synchronization Logic (Audio & Visual)

This document is written to permanently address the recurring **"Note Teleportation"** (노트 순간이동 현상) bug and serve as a single source of truth for the RhythmGame.ts synchronization logic.

## 🐛 The Problem (Note Teleportation)

Some MIDI files (e.g., `dw5_town.mid`, `백조의호수.mid`) contain leading silence/empty space at the very beginning of the track before the first note.
When using `SpessaSynth` (our core audio synthesizer), it automatically **skips this leading silence** when play is initiated.

As a result, an audio track that theoretically starts at `0.00s` actually starts playing at `1.75s` (for example).

If the game visual engine (`update()` and `render()`) blindly counts down a 3-second `preGameTimer` down to `0.00s` and then just swaps to `audioEngine.getPreciseTime()`, it will immediately realize the audio is at `1.75s`.
This causes a **quantum leap in visual time**, making 1.75 seconds worth of notes instantly "teleport" or pop onto the middle of the screen the exact moment the music starts.

## ⚖️ Previous Incomplete Fixes & Regressions

In earlier patches, the game attempted to freeze the `render()` loop to `-preGameTimer` while leaving the `update()` loop unaffected or using slightly different latency calculations. This caused internal desync. When performance optimizations and `outputLatencyMs` (audio delay compensation) were added, the two loops disagreed entirely on what time it was during the transition frame, causing the bug to return.

## 🛠️ The Ultimate Solution: Unified Sync Formula

To prevent this from ever happening again, the game now relies on three pillars:

### 1. The "Dry Seek" (사전 탐색)

Before the `preGameTimer` even starts counting down, the game "pokes" the audio engine:

```typescript
this.audioEngine.seek(0);
this.effectiveStartTime = this.audioEngine.currentTime; // e.g., 1.75s instead of 0s
```

This discovers the actual, silence-skipped start point *before* gameplay begins.

### 2. Output Latency Verification

We capture `this.outputLatencyMs` (the hardware audio delay) precisely *once* per song start.

### 3. The Grand Unified Formula

During the `preGameTimer` countdown (the "Lead-in" phase), both the `update()` loop and the `render()` loop must calculate `currentTime` using **exactly the same math**:

```typescript
// (Target Start Point - Hardware Latency) - Remaining Countdown
currentTime = (this.effectiveStartTime * 1000 - this.outputLatencyMs) - this.preGameTimer;
```

When `preGameTimer` hits `0`, the formula naturally resolves to `(effectiveStartTime * 1000 - outputLatencyMs)`.
At that exact millisecond, `audioEngine.play()` is called, and the time smoothly hands over to:

```typescript
currentTime = (this.audioEngine.getPreciseTime() * 1000) - this.outputLatencyMs;
```

Because `getPreciseTime()` immediately returns `effectiveStartTime`, the handoff is **mathematically identical**. There is zero time jump, zero teleportation, and perfect visual-audio synchronization.

## 🚨 Guidelines for Future Maintenance

1. **Never alter the lead-in formula** without updating both `update()` and `render()`.
2. Hardware audio latency (`outputLatencyMs`) must always be subtracted from the total time so players hit notes on the exact frame the speaker outputs the sound.
3. If changing the `preGameTimer` duration to be longer or shorter, the formula remains valid. Just ensure `preGameTimer -= delta` is strictly respected.
