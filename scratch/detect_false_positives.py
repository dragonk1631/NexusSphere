import librosa
import numpy as np
import json
import os

def analyze_noise_floor(audio_path, json_path):
    if not os.path.exists(audio_path) or not os.path.exists(json_path):
        return
        
    y, sr = librosa.load(audio_path, sr=22050)
    # RMS per frame
    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop_length)
    
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    melody = data.get('melody', [])
    
    # Check energy at each note's time
    noise_notes = []
    for n in melody:
        t = n['time']
        rms_idx = np.argmin(np.abs(times - t))
        local_rms = rms[rms_idx]
        n['local_rms'] = float(local_rms)
        if local_rms < 0.002: # Extremely low energy
            noise_notes.append(n)
            
    print(f"Total Notes: {len(melody)}")
    print(f"Notes with energy < 0.002: {len(noise_notes)}")
    if noise_notes:
        print(f"Example Noise Note: {noise_notes[0]}")

analyze_noise_floor("b:/NexusSphere/public/assets/audio/mp3/demucs_out/htdemucs/Your Smiling Face/vocals.wav", "b:/NexusSphere/scratch/analysis_debug.json")
