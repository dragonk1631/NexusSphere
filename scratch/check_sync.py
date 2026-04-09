import librosa
import numpy as np
import json
import os

def check_sync(audio_path, json_path):
    if not os.path.exists(audio_path) or not os.path.exists(json_path):
        return
        
    # Load audio to find first clear peak
    y, sr = librosa.load(audio_path, sr=22050)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    times = librosa.frames_to_time(range(len(onset_env)), sr=sr)
    
    # Find first major onset (thresholded)
    peaks = librosa.util.peak_pick(onset_env, pre_max=7, post_max=7, pre_avg=7, post_avg=7, delta=0.5, wait=30)
    first_audio_onset = times[peaks[0]] if len(peaks) > 0 else 0
    
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    melody = data.get('melody', [])
    first_midi_note = melody[0]['time'] if melody else 0
    
    print(f"First Audio Onset: {first_audio_onset:.4f}s")
    print(f"First MIDI Note:  {first_midi_note:.4f}s")
    print(f"Diff (Sync Error): {first_midi_note - first_audio_onset:.4f}s")

check_sync("b:/NexusSphere/public/assets/audio/mp3/demucs_out/htdemucs/Your Smiling Face/vocals.wav", "b:/NexusSphere/scratch/analysis_fidelity.json")
