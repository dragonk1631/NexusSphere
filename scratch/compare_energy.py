import librosa
import numpy as np
import os

def check_silence(path):
    if not os.path.exists(path):
        return None
    y, sr = librosa.load(path, sr=22050)
    # Get RMS energy per frame
    rms = librosa.feature.rms(y=y)[0]
    return {
        "max": np.max(rms),
        "mean": np.mean(rms),
        "std": np.std(rms)
    }

base = "Your Smiling Face"
demucs_v = f"b:/NexusSphere/public/assets/audio/mp3/demucs_out/htdemucs/{base}/vocals.wav"
spleeter_v = f"b:/NexusSphere/public/assets/audio/mp3/spleeter_out/{base}/vocals.wav"

print(f"Demucs Vocal Energy: {check_silence(demucs_v)}")
print(f"Spleeter Vocal Energy: {check_silence(spleeter_v)}")
