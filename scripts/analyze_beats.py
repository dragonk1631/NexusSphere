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
    # More aggressive margin for percussive component
    y_harm, y_perc = librosa.effects.hpss(y, margin=(2.0, 5.0))

    # --- 3. BPM + beat positions ---
    tempo, beat_frames = librosa.beat.beat_track(
        y=y_perc, sr=sr, units='frames', trim=False
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo[0] if hasattr(tempo, '__len__') else tempo)

    # --- 4. Multi-band Drum Detection (High Resolution) ---
    # Using 256 hop_length for ~11.6ms precision (sr=22050)
    hop_length_hires = 256
    D_perc = np.abs(librosa.stft(y_perc, hop_length=hop_length_hires))
    freqs = librosa.fft_frequencies(sr=sr)
    
    # Low frequency mask (< 120Hz for Kick)
    lf_mask = freqs < 120
    # High frequency mask (> 300Hz for Snare/Hat)
    hf_mask = freqs > 300

    # Onset strength for Low Band (Kick)
    # Using mean for Kick to capture the transient better
    o_env_low = librosa.onset.onset_strength(
        sr=sr, S=D_perc[lf_mask, :], aggregate=np.mean, hop_length=hop_length_hires
    )
    # Onset strength for High Band (Snare/Hat)
    # Using median for Snare to reduce noise spikes
    o_env_high = librosa.onset.onset_strength(
        sr=sr, S=D_perc[hf_mask, :], aggregate=np.median, hop_length=hop_length_hires
    )

    # Detect Low Band Onsets (Kick)
    # wait=3 at 256 hop is ~35ms, plenty for kick
    kick_frames = librosa.onset.onset_detect(
        onset_envelope=o_env_low, sr=sr, hop_length=hop_length_hires,
        units='frames', backtrack=True,
        pre_max=2, post_max=1, pre_avg=20, post_avg=20,
        delta=0.035, wait=3
    )

    # Detect High Band Onsets (Snare/Fills)
    # wait=2 at 256 hop is ~23ms, allowing 32nd notes at 160BPM
    snare_frames = librosa.onset.onset_detect(
        onset_envelope=o_env_high, sr=sr, hop_length=hop_length_hires,
        units='frames', backtrack=True,
        pre_max=1, post_max=1, pre_avg=15, post_avg=15,
        delta=0.03, wait=2
    )

    # --- 5. Melody onset detection on harmonic component ---
    melody_onset_frames = librosa.onset.onset_detect(
        y=y_harm, sr=sr,
        units='frames', backtrack=True,
        pre_max=3, post_max=3, pre_avg=50, post_avg=50,
        delta=0.07, wait=8
    )
    melody_onset_times = librosa.frames_to_time(melody_onset_frames, sr=sr)

    # --- 6. Energy Extraction & Noise Floor Gating ---
    hop_length_std = 512
    perc_rms = librosa.feature.rms(y=y_perc, frame_length=2048, hop_length=hop_length_std)[0]
    harm_rms = librosa.feature.rms(y=y_harm, frame_length=2048, hop_length=hop_length_std)[0]
    total_rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length_std)[0]
    
    # Absolute noise floor (-45dB)
    noise_floor = np.max(total_rms) * 0.005 # ~ -46dB from peak

    def frames_to_energy(onset_frames, rms, hop_ratio=1.0):
        energies = []
        for f in onset_frames:
            idx = min(int(f * hop_ratio), len(rms)-1)
            energies.append(float(rms[idx]))
        mx = max(energies) if energies else 1.0
        return [e / mx if mx > 0 else 0.5 for e in energies]

    # --- 7. Adaptive Signature-based Drum Refinement ---
    def filter_onsets(onset_frames, sign_env, current_rms, h_rms, ratio_std=0.5):
        filtered = []
        if len(onset_frames) == 0: return []
        
        # 1. Build a pool of diverse Master Templates (Top 20 strong hits)
        onsets_with_energy = [(f, sign_env[int(f)]) for f in onset_frames]
        onsets_with_energy.sort(key=lambda x: x[1], reverse=True)
        
        template_pool = []
        for f, _ in onsets_with_energy[:25]:
            col = int(f)
            if col < D_perc.shape[1]:
                vec = D_perc[:, col]
                norm = np.linalg.norm(vec)
                if norm > 1e-6:
                    template_pool.append(vec / norm)
        
        if not template_pool: return onset_frames

        for f in onset_frames:
            col = int(f)
            rms_idx = min(int(f * ratio_std), len(current_rms)-1)
            
            # Gating 1: Absolute Energy
            if current_rms[rms_idx] < (noise_floor * 0.75):
                continue
                
            # Gating 2: Adaptive Context Analysis (HPR)
            hpr = h_rms[rms_idx] / (current_rms[rms_idx] + 1e-6)
            
            # Context-aware thresholding:
            # - If hpr is low (< 1.5), it's very likely a drum. Be very lenient.
            # - If hpr is high (> 3.0), it's likely vocal/melody. Be very strict.
            if hpr < 1.5:
                sim_threshold = 0.12  # Very lenient
            elif hpr < 3.0:
                sim_threshold = 0.22  # Balanced
            else:
                sim_threshold = 0.38  # Strict (Vocal territory)
            
            # Gating 3: Multi-Template Similarity Match
            if col < D_perc.shape[1]:
                vec = D_perc[:, col]
                norm = np.linalg.norm(vec)
                if norm > 1e-6:
                    cur_sig = vec / norm
                    # Check similarity against all templates in the pool
                    similarities = [np.dot(cur_sig, t) for t in template_pool]
                    max_sim = max(similarities)
                    
                    if max_sim < sim_threshold:
                        continue
            
            filtered.append(f)
        return filtered

    kick_frames_filtered  = filter_onsets(kick_frames, o_env_low, perc_rms, harm_rms)
    snare_frames_filtered = filter_onsets(snare_frames, o_env_high, perc_rms, harm_rms)

    kick_frames_filtered  = filter_onsets(kick_frames, o_env_low, perc_rms, harm_rms)
    snare_frames_filtered = filter_onsets(snare_frames, o_env_high, perc_rms, harm_rms)

    kick_times  = librosa.frames_to_time(kick_frames_filtered, sr=sr, hop_length=hop_length_hires)
    snare_times = librosa.frames_to_time(snare_frames_filtered, sr=sr, hop_length=hop_length_hires)
    
    kick_energies  = frames_to_energy(kick_frames_filtered, perc_rms, hop_ratio=0.5)
    snare_energies = frames_to_energy(snare_frames_filtered, perc_rms, hop_ratio=0.5)
    melody_energies = frames_to_energy(melody_onset_frames, harm_rms)

    # --- 8. Build output ---
    all_drums = []
    for t, e in zip(kick_times, kick_energies):
        all_drums.append({"time": round(float(t), 4), "energy": round(e, 4), "type": "kick"})
    for t, e in zip(snare_times, snare_energies):
        all_drums.append({"time": round(float(t), 4), "energy": round(e, 4), "type": "snare"})
    
    all_drums.sort(key=lambda x: x['time'])

    result = {
        "bpm": round(bpm, 2),
        "duration": round(duration, 3),
        "beats": [round(float(t), 4) for t in beat_times.tolist()],
        "drums": all_drums,
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
