import librosa
import numpy as np
import os

def check_bleed(vocal_path, original_path):
    if not os.path.exists(vocal_path) or not os.path.exists(original_path):
        return
    y_v, sr = librosa.load(vocal_path, sr=22050)
    y_o, _ = librosa.load(original_path, sr=22050)
    
    rms_v = librosa.feature.rms(y=y_v)[0]
    rms_o = librosa.feature.rms(y=y_o)[0]
    
    # Calculate ratio of vocal energy to total energy
    ratio = rms_v / (rms_o + 1e-6)
    
    print(f"Mean Vocal/Total Ratio: {np.mean(ratio):.4f}")
    print(f"Max Vocal/Total Ratio: {np.max(ratio):.4f}")
    print(f"Min Vocal/Total Ratio: {np.min(ratio):.4f}")
    
    # Check sections where ratio is low (< 0.1) - these are likely bleed
    bleed_frames = np.where(ratio < 0.1)[0]
    print(f"Potential Bleed Frames (Ratio < 0.1): {len(bleed_frames)} / {len(ratio)}")

check_bleed("b:/NexusSphere/public/assets/audio/mp3/demucs_out/htdemucs/Your Smiling Face/vocals.wav", "b:/NexusSphere/public/assets/audio/mp3/Your Smiling Face.mp3")
