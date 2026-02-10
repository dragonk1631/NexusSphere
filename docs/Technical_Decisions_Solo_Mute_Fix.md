# Technical Decision: MIDI Solo/Mute Leakage Fix

## Problem

In the MIDI Editor, soloing a channel sometimes failed to silence other channels. Muted channels would occasionally become audible during playback, especially after volume swells or dynamic changes in the music.

## Root Cause Analysis

1. **Initial Implementation**: Muting relied on setting Channel Volume (CC 7) to 0.
    * *Issue*: Creating `CC 7 = 0` events does not stop existing events in the MIDI file from being processed. If the MIDI file contained volume automation (e.g., `CC 7 = 100`) later in the track, it would override our mute setting.
2. **Second Attempt (Sequencer Muting)**: We implemented `setTrackMute` to disable the track in the sequencer.
    * *Issue*: Disabling the "Conductor Track" (Track 0) stopped the Tempo Map from updating, causing the song's BPM to freeze.
3. **Third Attempt (Conditional Protection)**: We protected Track 0 from being disabled.
    * *New Issue*: Some MIDI files are "Polluted". Track 0 should only contain Tempo/TimeSig events, but some files also include Note or Automation events for specific instruments in Track 0. By protecting Track 0, we allowed these leakage events to pass through.

## Solution

### 1. Robust Track Muting (The "Gatekeeper")

We now iterate through all tracks and disable them at the sequencer level (`track.disabled = true`) if they belong to a muted channel.

* **Exception**: We **ALWAYS** keep Track 0 enabled to preserve the Tempo Map.

### 2. Brute-Force Volume Enforcement (The "Hammer")

Since we cannot disable Track 0 (which might be polluted with volume commands), we implemented a frame-by-frame enforcement mechanism.

* **`enforceMuteCompliance()`**: Runs every frame in the `update()` loop.
* It checks all 16 MIDI channels.
* If a channel is supposed to be muted, it **forcibly sets the volume to 0**.
* This immediately overrides any "rogue" volume commands that might leak from the Polluted Conductor Track.

## Performance Optimization

Calling `setChannelVolume(ch, 0)` every frame is expensive because it typically sends:

1. `CC 7 = 0` (Volume)
2. `CC 120 = 0` (All Sound Off) - *Panic Command*
3. `CC 123 = 0` (All Notes Off) - *Panic Command*

Sending ~3 MIDI messages x 16 channels x 60 frames = **~2,880 MIDI events/sec**. This causes high CPU load and audio artifacts (clicking/zippering).

**Optimization**:
We introduced `CoreAudioEngine.overrideChannelVolume(channel, volume)`.

* This method **ONLY** sends `CC 7` (Volume).
* It avoids the expensive Panic commands.
* Result: **~960 simple events/sec**. This is lightweight enough to run every frame without side effects.

## Conclusion

This hybrid approach (Sequencer Disabling + Lightweight Frame Enforcement) ensures:

1. **100% Silence** on muted channels (even with polluted tracks).
2. **Correct Tempo** (Conductor track stays active).
3. **High Performance** (No audio glitches or CPU spikes).
