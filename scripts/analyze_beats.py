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
    sr = 22050
    y, _ = librosa.load(mp3_path, mono=True, sr=sr)
    duration = librosa.get_duration(y=y, sr=sr)

    # --- 2. Deep Learning Source Separation (Demucs v4) ---
    import os
    import subprocess
    
    mp3_abspath = os.path.abspath(mp3_path)
    base_name = os.path.splitext(os.path.basename(mp3_abspath))[0]
    out_dir = os.path.join(os.path.dirname(mp3_abspath), "demucs_out")
    
    print(f"  [AI] Separating stems with HTDemucs v4 for {base_name}...", file=sys.stderr)
    try:
        # Demucs CLI output structure: {out_dir}/htdemucs/{base_name}/vocals.wav
        vocals_path = os.path.join(out_dir, "htdemucs", base_name, "vocals.wav")
        drums_path = os.path.join(out_dir, "htdemucs", base_name, "drums.wav")
        
        if not os.path.exists(vocals_path) or not os.path.exists(drums_path):
            # Using CLI for maximum stability
            cmd = [
                "demucs",
                "-n", "htdemucs",
                "-o", out_dir,
                "--shifts", "2",
                mp3_abspath
            ]
            print(f"  [AI] Running command: {' '.join(cmd)}", file=sys.stderr)
            subprocess.run(cmd, check=True, capture_output=True)
        else:
            print(f"  [AI] Cached HTDemucs stems found.", file=sys.stderr)
            
        y_harm, _ = librosa.load(vocals_path, mono=True, sr=sr)
        y_perc, _ = librosa.load(drums_path, mono=True, sr=sr)
        
        # Match lengths
        if len(y_harm) < len(y): y_harm = np.pad(y_harm, (0, len(y) - len(y_harm)))
        else: y_harm = y_harm[:len(y)]
        
        if len(y_perc) < len(y): y_perc = np.pad(y_perc, (0, len(y) - len(y_perc)))
        else: y_perc = y_perc[:len(y)]
        
        print(f"  [AI] Vocal isolation (Demucs) successful.", file=sys.stderr)
        
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"  [AI Warning] Demucs failed ({e}). Falling back to simple HPSS filter.", file=sys.stderr)
        y_harm, y_perc = librosa.effects.hpss(y, margin=(2.0, 5.0))
        vocals_path = mp3_abspath 

    # --- 3. BPM + beat positions ---
    tempo, beat_frames = librosa.beat.beat_track(
        y=y_perc, sr=sr, units='frames', trim=False
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    bpm = float(tempo[0] if hasattr(tempo, '__len__') else tempo)

    # --- 4. Multi-band Drum Detection (High Resolution) ---
    hop_length_hires = 256
    D_perc = np.abs(librosa.stft(y_perc, hop_length=hop_length_hires))
    freqs = librosa.fft_frequencies(sr=sr)
    
    lf_mask = freqs < 120
    hf_mask = freqs > 300

    o_env_low = librosa.onset.onset_strength(
        sr=sr, S=D_perc[lf_mask, :], aggregate=np.mean, hop_length=hop_length_hires
    )
    o_env_high = librosa.onset.onset_strength(
        sr=sr, S=D_perc[hf_mask, :], aggregate=np.median, hop_length=hop_length_hires
    )

    kick_frames = librosa.onset.onset_detect(
        onset_envelope=o_env_low, sr=sr, hop_length=hop_length_hires,
        units='frames', backtrack=True,
        pre_max=2, post_max=1, pre_avg=20, post_avg=20,
        delta=0.035, wait=3
    )

    snare_frames = librosa.onset.onset_detect(
        onset_envelope=o_env_high, sr=sr, hop_length=hop_length_hires,
        units='frames', backtrack=True,
        pre_max=1, post_max=1, pre_avg=15, post_avg=15,
        delta=0.03, wait=2
    )

    # --- 5. Energy Extraction & Precision Noise Floor Gating ---
    hop_length_std = 512
    # Frame-by-frame energy for isolated vocals and original audio
    vocal_rms = librosa.feature.rms(y=y_harm, frame_length=2048, hop_length=hop_length_std)[0]
    total_rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length_std)[0]
    perc_rms = librosa.feature.rms(y=y_perc, frame_length=2048, hop_length=hop_length_std)[0]
    
    # Calculate Vocal-to-Total energy ratio (Silence/Bleed Mask)
    # If vocals are much weaker than background, it's likely bleed noise.
    energy_ratio = vocal_rms / (total_rms + 1e-6)
    
    # Absolute noise floor
    noise_floor = np.max(total_rms) * 0.005 

    # --- 6. Spotify Basic-Pitch Neural Network Inference ---
    print(f"  [AI] Running Basic-Pitch Neural Network on isolated vocals...", file=sys.stderr)
    try:
        import io
        from basic_pitch.inference import predict
        from collections import Counter
        
        # Suppress noisy stdout
        original_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            target_audio = vocals_path if os.path.exists(vocals_path) else mp3_abspath
            # Tuning for HIGH FIDELITY: Lower thresholds for better coverage,
            # using our Energy-Ratio gate to prevent false positives.
            _, _, note_events = predict(
                target_audio,
                onset_threshold=0.48,   # Improved sensitivity
                frame_threshold=0.35,   # Catch soft/breathy starts
                minimum_note_length=100 # Catch faster melodic phrases
            )
        finally:
            sys.stdout = original_stdout
        
        # --- 6.1 Transcription Sync & Fidelity Refiner (v2.4) ---
        class VocalFidelityRefiner:
            def __init__(self, notes, audio_rms_v, audio_rms_t, ts_frames, bpm=120):
                self.notes = sorted(notes, key=lambda x: x[0])
                self.v_rms = audio_rms_v
                self.t_rms = audio_rms_t
                self.ts = ts_frames
                self.bpm = bpm
                self.LATENCY_OFFSET = -0.25
                
                bpm_factor = 120.0 / max(float(self.bpm), 80.0)
                self.STABILITY_TIME = 0.12 * bpm_factor
            
            def get_local_ratio(self, t):
                idx = np.argmin(np.abs(self.ts - t))
                return self.v_rms[idx] / (self.t_rms[idx] + 1e-6)

            def refine(self):
                if not self.notes: return []
                
                # 1. Sync & Gating
                filtered = []
                for n in self.notes:
                    s_t, e_t, pitch, energy, _ = n
                    s_c, e_c = max(0, s_t + self.LATENCY_OFFSET), max(0, e_t + self.LATENCY_OFFSET)
                    if e_c <= s_c: continue
                    if self.get_local_ratio(s_t) > 0.11:
                        filtered.append({"start": s_c, "end": e_c, "pitch": int(pitch), "energy": float(energy), "segments": [[s_c, e_c, int(pitch)]]})
                
                if not filtered: return []

                # 2. ELASTIC BRIDGE PASS: Merge ±1 semitone fragments (fix scattering)
                # We group notes into "Breath Phrases"
                phrases = []
                for n in filtered:
                    if not phrases:
                        phrases.append(n)
                        continue
                    
                    prev = phrases[-1]
                    gap = n["start"] - prev["end"]
                    last_pitch = prev["segments"][-1][2]
                    p_diff = abs(n["pitch"] - last_pitch)
                    
                    # Contextual Bridging (v2.6):
                    # Distinguish between jitter/slides vs. intentional melodic steps.
                    avg_energy = (prev["energy"] + n["energy"]) / 2
                    is_climax = avg_energy > 0.6
                    
                    # Rhythmic Threshold (approx 16th note)
                    # Anything held longer than this is a real note, not jitter.
                    # 120ms at 120 BPM, approx 80ms at 180 BPM
                    bpm_factor = 120.0 / max(float(self.bpm), 80.0)
                    stable_threshold = 0.15 * bpm_factor
                    
                    # Determine pitch tolerance
                    # Allow ±1 for normal vibrato.
                    # Allow ±2 only for EXTRA SHORT transitions in climaxes.
                    n_dur = n["end"] - n["start"]
                    if is_climax and p_diff <= 2 and n_dur < stable_threshold:
                        pitch_tolerance = 2
                    elif p_diff <= 1:
                        pitch_tolerance = 1
                    else:
                        pitch_tolerance = 0 # Forced split
                    
                    # Elastic Bridge Logic
                    if p_diff <= pitch_tolerance and gap < 0.4:
                        prev["end"] = max(prev["end"], n["end"])
                        prev["energy"] = avg_energy
                        prev["segments"].extend(n["segments"])
                    else:
                        phrases.append(n)

                # 3. MODAL REALIGNMENT & GHOST PURGE
                realigned = []
                for p in phrases:
                    duration = p["end"] - p["start"]
                    # GHOST PURGE: Remove tiny artifacts that might disrupt the flow
                    if duration < 0.06: continue
                    
                    # Re-calculate Modal Pitch for the entire phrase for stability
                    all_segment_pitches = []
                    for s_start, s_end, s_pitch in p["segments"]:
                        # Weight by duration
                        weight = int((s_end - s_start) * 100) + 1
                        all_segment_pitches.extend([s_pitch] * weight)
                    
                    if all_segment_pitches:
                        final_pitch = Counter(all_segment_pitches).most_common(1)[0][0]
                    else:
                        final_pitch = p["pitch"]

                    realigned.append({
                        "time": round(float(p["start"]), 4),
                        "duration": round(float(duration), 4),
                        "pitch": int(final_pitch),
                        "energy": round(float(p["energy"]), 4)
                    })

                # 4. FINAL PHRASE MERGE: Combine adjacent realigned notes with same pitch
                merged = []
                for r in realigned:
                    if not merged:
                        merged.append(r)
                        continue
                    prev = merged[-1]
                    gap = r['time'] - (prev['time'] + prev['duration'])
                    if r['pitch'] == prev['pitch'] and gap < 0.2:
                        prev['duration'] = round(float(r['time'] + r['duration'] - prev['time']), 4)
                        prev['energy'] = round((prev['energy'] + r['energy']) / 2, 4)
                    else:
                        merged.append(r)

                # 5. STRICT MONOPHONIC PASS: Truncate overlaps
                final = []
                epsilon = 0.001
                for s in merged:
                    if not final:
                        final.append(s)
                        continue
                    
                    prev = final[-1]
                    prev_end = prev['time'] + prev['duration']
                    if s['time'] < (prev_end - epsilon):
                        new_dur = s['time'] - prev['time']
                        if new_dur > 0.03:
                            prev['duration'] = round(float(new_dur), 4)
                        else:
                            final.pop()
                            if not final:
                                final.append(s)
                                continue
                    final.append(s)

                return final

        # Times corresponding to RMS frames for gating
        rms_times = librosa.frames_to_time(range(len(vocal_rms)), sr=sr, hop_length=hop_length_std)
        
        # Pass the extracted BPM for stability scaling
        refiner = VocalFidelityRefiner(note_events, vocal_rms, total_rms, rms_times, bpm=bpm)
        melody_data = refiner.refine()
        
        print(f"  [AI] Vocal Fidelity v2.2 complete: {len(melody_data)} refined segments (BPM: {bpm:.1f}).", file=sys.stderr)
        
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"  [AI Warning] Restoration failed: {e}. Falling back to empty melody.", file=sys.stderr)
        melody_data = []

    # --- 7. Adaptive Signature-based Drum Refinement ---
    def frames_to_energy(onset_frames, rms, hop_ratio=1.0):
        energies = []
        for f in onset_frames:
            idx = min(int(f * hop_ratio), len(rms)-1)
            energies.append(float(rms[idx]))
        mx = max(energies) if energies else 1.0
        return [e / mx if mx > 0 else 0.5 for e in energies]

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

    kick_frames_filtered  = filter_onsets(kick_frames, o_env_low, perc_rms, vocal_rms)
    snare_frames_filtered = filter_onsets(snare_frames, o_env_high, perc_rms, vocal_rms)

    kick_times  = librosa.frames_to_time(kick_frames_filtered, sr=sr, hop_length=hop_length_hires)
    snare_times = librosa.frames_to_time(snare_frames_filtered, sr=sr, hop_length=hop_length_hires)
    
    kick_energies  = frames_to_energy(kick_frames_filtered, perc_rms, hop_ratio=0.5)
    snare_energies = frames_to_energy(snare_frames_filtered, perc_rms, hop_ratio=0.5)

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
        "melody": melody_data
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
