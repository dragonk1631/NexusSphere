#!/usr/bin/env python3
"""
NexusSphere librosa Beat Analyzer
Extracts precise onset timings and BPM from an MP3 file using librosa.
Output: JSON to stdout
"""
import sys
import json
import warnings
warnings.filterwarnings('ignore')

import librosa
import numpy as np

def analyze(mp3_path):
    # --- 1. Load audio (mono, 22050 Hz) ---
    y, sr = librosa.load(mp3_path, mono=True, sr=22050)
    duration = librosa.get_duration(y=y, sr=sr)

    # --- 2. HPSS: separate Harmonic and Percussive ---
    y_harm, y_perc = librosa.effects.hpss(y, margin=4.0)

    # --- 3. BPM + beat positions via Percussive component ---
    tempo, beat_frames = librosa.beat.beat_track(
        y=y_perc, sr=sr, units='frames', trim=False
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo[0] if hasattr(tempo, '__len__') else tempo)

    # --- 4. Drum onset detection on percussive component ---
    # Using onset_detect with default parameters, which are tuned for drums
    drum_onset_frames = librosa.onset.onset_detect(
        y=y_perc, sr=sr,
        units='frames',
        pre_max=3, post_max=3,
        pre_avg=100, post_avg=100,
        delta=0.08, wait=10
    )
    drum_onset_times = librosa.frames_to_time(drum_onset_frames, sr=sr)

    # --- 5. Melody onset detection on harmonic component ---
    melody_onset_frames = librosa.onset.onset_detect(
        y=y_harm, sr=sr,
        units='frames',
        pre_max=3, post_max=3,
        pre_avg=80, post_avg=80,
        delta=0.10, wait=10
    )
    melody_onset_times = librosa.frames_to_time(melody_onset_frames, sr=sr)

    # --- 6. Energy at each onset for velocity mapping ---
    hop_length = 512
    perc_rms = librosa.feature.rms(y=y_perc, frame_length=2048, hop_length=hop_length)[0]
    harm_rms  = librosa.feature.rms(y=y_harm,  frame_length=2048, hop_length=hop_length)[0]

    def frames_to_energy(onset_frames, rms):
        energies = []
        for f in onset_frames:
            idx = min(int(f), len(rms)-1)
            energies.append(float(rms[idx]))
        # Normalize 0-1
        mx = max(energies) if energies else 1.0
        return [e / mx if mx > 0 else 0.5 for e in energies]

    drum_energies   = frames_to_energy(drum_onset_frames,   perc_rms)
    melody_energies = frames_to_energy(melody_onset_frames, harm_rms)

    # --- 7. Build output ---
    result = {
        "bpm": round(bpm, 2),
        "duration": round(duration, 3),
        "beats": [round(float(t), 4) for t in beat_times.tolist()],
        "drums": [
            {"time": round(float(t), 4), "energy": round(e, 4)}
            for t, e in zip(drum_onset_times, drum_energies)
        ],
        "melody": [
            {"time": round(float(t), 4), "energy": round(e, 4)}
            for t, e in zip(melody_onset_times, melody_energies)
        ]
    }

    print(json.dumps(result))
    sys.stdout.flush()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file specified"}))
        sys.exit(1)
    try:
        analyze(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
