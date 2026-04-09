import json
import os

def audit_scattering(json_path):
    if not os.path.exists(json_path): return
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    melody = data.get('melody', [])
    clusters = []
    
    for i in range(len(melody) - 1):
        curr = melody[i]
        nxt = melody[i+1]
        
        curr_end = curr['time'] + curr['duration']
        nxt_start = nxt['time']
        gap = nxt_start - curr_end
        p_diff = abs(nxt['pitch'] - curr['pitch'])
        
        # Look for notes that are close in time AND pitch (within 1 semitone)
        # but NOT bridged.
        if gap < 0.4 and p_diff <= 1:
            clusters.append({
                "time": curr['time'],
                "gap": gap,
                "pitch_diff": p_diff,
                "durations": (curr['duration'], nxt['duration'])
            })
            
    print(f"Potential scattering clusters (Close pitch/time but separate): {len(clusters)}")
    for c in clusters[:10]:
        print(c)

audit_scattering(r"b:\NexusSphere\scratch\analysis_mono.json")
