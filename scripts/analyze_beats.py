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

def analyze(mp3_path, out_dir=None):
    # --- 1. Load audio (mono, 22050 Hz) ---
    sr = 22050
    y, _ = librosa.load(mp3_path, mono=True, sr=sr)
    duration = librosa.get_duration(y=y, sr=sr)

    # --- 2. Deep Learning Source Separation (Demucs v4) ---
    import os
    import subprocess
    
    mp3_abspath = os.path.abspath(mp3_path)
    base_name = os.path.splitext(os.path.basename(mp3_abspath))[0]
    
    if out_dir is None:
        out_dir = os.path.join(os.path.dirname(mp3_abspath), "demucs_out")
    else:
        out_dir = os.path.abspath(out_dir)
    
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
        
        # Load extra stems for multi-track inference
        bass_path = os.path.join(out_dir, "htdemucs", base_name, "bass.wav")
        other_path = os.path.join(out_dir, "htdemucs", base_name, "other.wav")
        
        y_bass, _ = librosa.load(bass_path, mono=True, sr=sr) if os.path.exists(bass_path) else (np.zeros_like(y), sr)
        y_other, _ = librosa.load(other_path, mono=True, sr=sr) if os.path.exists(other_path) else (np.zeros_like(y), sr)

        # Match lengths for all
        def sync_len(wav, target_len):
            if len(wav) < target_len: return np.pad(wav, (0, target_len - len(wav)))
            return wav[:target_len]
        
        y_harm = sync_len(y_harm, len(y))
        y_perc = sync_len(y_perc, len(y))
        y_bass = sync_len(y_bass, len(y))
        y_other = sync_len(y_other, len(y))
        
        print(f"  [AI] 4-Stem isolation (Demucs) successful.", file=sys.stderr)
        
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"  [AI Warning] Demucs failed ({e}). Falling back to simple HPSS filter.", file=sys.stderr)
        y_harm, y_perc = librosa.effects.hpss(y, margin=(2.0, 5.0))
        y_bass, y_other = np.zeros_like(y), np.zeros_like(y)
        vocals_path = mp3_abspath 
        bass_path = ""
        other_path = ""

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
    vocal_rms = librosa.feature.rms(y=y_harm, frame_length=2048, hop_length=hop_length_std)[0]
    bass_rms  = librosa.feature.rms(y=y_bass, frame_length=2048, hop_length=hop_length_std)[0]
    other_rms = librosa.feature.rms(y=y_other, frame_length=2048, hop_length=hop_length_std)[0]
    total_rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop_length_std)[0]
    perc_rms = librosa.feature.rms(y=y_perc, frame_length=2048, hop_length=hop_length_std)[0]
    
    noise_floor = np.max(total_rms) * 0.005 
        
    # --- 6. Triple Neural Network Inference (Basic-Pitch) ---
    print(f"  [AI] Running Triple Inference (Vocal, Bass, Instrumental)...", file=sys.stderr)
    
    from basic_pitch.inference import predict
    from collections import Counter
    import io
    from scipy.signal import medfilt

    class RhythmQuantizer:
        def __init__(self, beat_times, bpm):
            self.beats = beat_times
            self.bpm = bpm
            self.grid = []
            if len(beat_times) > 1:
                # Create a 1/16 grid by interpolating between beats
                for i in range(len(beat_times) - 1):
                    b1, b2 = beat_times[i], beat_times[i+1]
                    for j in range(16):
                        self.grid.append(b1 + (b2 - b1) * j / 16.0)
                self.grid.append(beat_times[-1])
            self.grid = np.array(self.grid)

        def snap(self, t, threshold=0.045, strength=1.0):
            if len(self.grid) == 0: return t
            idx = np.argmin(np.abs(self.grid - t))
            closest = self.grid[idx]
            diff = abs(t - closest)
            if diff < threshold:
                return t + (closest - t) * strength
            return t

    class MelodyRefiner:
        def __init__(self, notes, audio_rms_v, audio_rms_t, ts_frames, bpm=120, profile='vocal'):
            self.notes = sorted(notes, key=lambda x: x[0])
            self.v_rms = audio_rms_v
            self.t_rms = audio_rms_t
            self.ts = ts_frames
            self.bpm = bpm
            self.profile = profile
            self.quantizer = None # Set externally
            
            # Calibration for Demucs v4 + Basic-Pitch
            self.LATENCY_OFFSET = -0.015 # Compensation for neural buffer
            self.MAX_HOLD_SEC = 4.0
            
            # Gating sensitivity tuned for ISOLATED stems
            if self.profile == 'bass':
                self.ratio_gate = 0.06 
                self.MIN_SUB_DUR = 0.18 
                self.snap_strength = 1.0 # Strict for Bass
            elif self.profile == 'instrumental':
                self.ratio_gate = 0.22 
                self.MIN_SUB_DUR = 0.22 
                self.snap_strength = 0.9 # High for Instruments
            else: # Vocal
                self.ratio_gate = 0.05
                self.MIN_SUB_DUR = 0.15 
                self.snap_strength = 0.65 # Lenient for Vocals (preserve expression)
                
            if len(self.v_rms) > 0:
                self.intensity_cutoff = np.percentile(self.v_rms, 85)
            else:
                self.intensity_cutoff = 0.6
        
        def get_local_ratio(self, t):
            if len(self.ts) == 0: return 1.0
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
                
                # Check isolation ratio to filter ghosts
                if self.get_local_ratio(s_t) > self.ratio_gate:
                    # Quantization 
                    if self.quantizer:
                        s_c = self.quantizer.snap(s_c, strength=self.snap_strength)
                    
                    filtered.append({
                        "start": s_c, "end": e_c, "pitch": int(pitch), "energy": float(energy),
                        "segments": [[s_c, e_c, int(pitch)]]
                    })
            
            if not filtered: return []

            # 2. Phrase Bridging
            phrases = []
            bpm_factor = 120.0 / max(float(self.bpm), 80.0)
            
            for n in filtered:
                if not phrases:
                    phrases.append(n); continue
                
                prev = phrases[-1]
                gap = n["start"] - prev["end"]
                p_diff = abs(n["pitch"] - prev["segments"][-1][2])
                
                # Dynamic tolerance for bridging
                tolerance = 0
                if p_diff <= 2 and gap < 0.25: tolerance = 2
                elif p_diff <= 1 and gap < 0.35: tolerance = 1

                if p_diff <= tolerance:
                    prev["end"] = max(prev["end"], n["end"])
                    prev["segments"].extend(n["segments"])
                else:
                    phrases.append(n)

            # 3. Output Translation (Dynamic Pitch Splitting)
            final = []
            MIN_SUB_DUR = self.MIN_SUB_DUR  # Use Profile-specific Min duration
            
            for p in phrases:
                # Group segments by pitch within the phrase
                segments = sorted(p["segments"], key=lambda x: x[0])
                if not segments: continue
                
                current_note = None
                
                for i, s in enumerate(segments):
                    s_start, s_end, s_pitch = s
                    
                    if current_note is None:
                        current_note = {"start": s_start, "end": s_end, "pitch": s_pitch}
                    else:
                        # If pitch is the same, extend the current note
                        if s_pitch == current_note["pitch"]:
                            current_note["end"] = max(current_note["end"], s_end)
                        else:
                            # Pitch changed. Check if the current note has met MIN_SUB_DUR
                            dur = current_note["end"] - current_note["start"]
                            if dur >= MIN_SUB_DUR or i == len(segments) - 1:
                                # Close current note and start new one
                                # Apply Pitch Smoothing (Median of segments)
                                if self.profile == 'vocal' and len(p["segments"]) > 3:
                                    pitches = [seg[2] for seg in p["segments"] if seg[0] >= current_note["start"] and seg[1] <= current_note["end"]]
                                    if pitches:
                                        refined_pitch = int(np.median(pitches))
                                    else:
                                        refined_pitch = int(current_note["pitch"])
                                else:
                                    refined_pitch = int(current_note["pitch"])

                                final.append({
                                    "time": round(float(current_note["start"]), 4),
                                    "duration": round(float(dur), 4),
                                    "pitch": refined_pitch,
                                    "energy": round(float(p["energy"]), 4)
                                })
                                current_note = {"start": s_start, "end": s_end, "pitch": s_pitch}
                            else:
                                # Too short to split? 
                                # Merge into current note but keep new pitch as the candidate
                                current_note["end"] = max(current_note["end"], s_end)
                                current_note["pitch"] = s_pitch
                
                # Close the last note of the phrase
                if current_note:
                    dur = current_note["end"] - current_note["start"]
                    if dur >= 0.05: # Guard for very last bits
                        final.append({
                            "time": round(float(current_note["start"]), 4),
                            "duration": round(float(dur), 4),
                            "pitch": int(current_note["pitch"]),
                            "energy": round(float(p["energy"]), 4)
                        })
            
            # 4. Monophonic Enforcement (Kill overlap for Inst/Bass)
            if self.profile in ['instrumental', 'bass']:
                final = self.enforce_monophony(final)
                
            return final

        def enforce_monophony(self, notes):
            if not notes: return []
            sorted_notes = sorted(notes, key=lambda x: x['time'])
            result = []
            
            for n in sorted_notes:
                if not result:
                    result.append(n); continue
                
                prev = result[-1]
                prev_end = prev['time'] + prev['duration']
                
                # Overlap detected?
                if n['time'] < prev_end - 0.02: # 20ms tolerance
                    if n['energy'] > prev['energy'] * 1.1: 
                        # New note is significantly stronger: Cut previous note
                        prev['duration'] = max(0.05, n['time'] - prev['time'])
                        result.append(n)
                    else:
                        # New note is weaker or similar: Delay new note or skip it
                        if (n['time'] + n['duration']) > prev_end + 0.1:
                            orig_end = n['time'] + n['duration']
                            n['time'] = prev_end + 0.02
                            n['duration'] = max(0.05, orig_end - n['time'])
                            result.append(n)
                        else:
                            continue # Skip it
                else:
                    result.append(n)
            return result

    rms_times = librosa.frames_to_time(range(len(vocal_rms)), sr=sr, hop_length=hop_length_std)
    
    # Initialize Quantizer
    quantizer = RhythmQuantizer(beat_times, bpm)
    
    def run_inference(audio_path, rms, total_rms, ts, profile, onset_th=0.5, frame_th=0.3):
        if not os.path.exists(audio_path): return []
        print(f"    [AI] {profile} inference (th={onset_th})...", file=sys.stderr)
        original_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            _, _, events = predict(audio_path, onset_threshold=onset_th, frame_threshold=frame_th, minimum_note_length=100)
        finally:
            sys.stdout = original_stdout
            
        refiner = MelodyRefiner(events, rms, total_rms, ts, bpm=bpm, profile=profile)
        refiner.quantizer = quantizer # Apply global grid
        return refiner.refine()

    vocal_data = run_inference(vocals_path, vocal_rms, total_rms, rms_times, 'vocal', 0.5, 0.3)
    bass_data  = run_inference(bass_path, bass_rms, total_rms, rms_times, 'bass', 0.6, 0.45)
    other_data = run_inference(other_path, other_rms, total_rms, rms_times, 'instrumental', 0.75, 0.55)


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
        "vocal": vocal_data,
        "bass": bass_data,
        "instrumental": other_data
    }

    print(json.dumps(result))
    sys.stdout.flush()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file specified"}))
        sys.exit(1)
    try:
        if len(sys.argv) > 2:
            analyze(sys.argv[1], sys.argv[2])
        else:
            analyze(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
