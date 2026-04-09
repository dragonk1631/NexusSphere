import json
import os

filepath = r"b:\NexusSphere\scratch\analysis_restored.json"
if os.path.exists(filepath):
    try:
        with open(filepath, 'r', encoding='utf-16') as f:
            data = json.load(f)
        
        melody = data.get('melody', [])
        print(f"Total melody notes: {len(melody)}")
        
        # Check for jitter (short duration, close in time)
        jitters = 0
        for i in range(1, len(melody)):
            prev = melody[i-1]
            curr = melody[i]
            gap = curr['time'] - (prev['time'] + prev['duration'])
            pitch_diff = abs(curr['pitch'] - prev['pitch'])
            
            if gap < 0.2 and pitch_diff == 1:
                jitters += 1
                if jitters < 10:
                    print(f"Potential Jitter: {prev['time']}s [P:{prev['pitch']}] -> {curr['time']}s [P:{curr['pitch']}] Gap: {gap:.3f}")
        
        print(f"Total potential jitter points: {jitters}")
        
        # Check for very short notes
        shorts = [n for n in melody if n['duration'] < 0.15]
        print(f"Short notes (<0.15s): {len(shorts)}")
        
    except Exception as e:
        print(f"Error: {e}")
else:
    print("File not found")
