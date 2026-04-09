import json
import os

def check_monophonic_violations(json_path):
    if not os.path.exists(json_path):
        print("File not found.")
        return
        
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    melody = data.get('melody', [])
    violations = 0
    fragments = 0
    
    for i in range(len(melody) - 1):
        curr = melody[i]
        nxt = melody[i+1]
        
        curr_end = curr['time'] + curr['duration']
        nxt_start = nxt['time']
        
        # 1. Overlap Check (with 2ms tolerance for float rounding)
        if nxt_start < (curr_end - 0.002):
            violations += 1
            print(f"Overlap found at {nxt_start:.4f}s: CurrEnd={curr_end:.4f}s")
            
        # 2. Fragmentation Check (Same pitch, small gap)
        if curr['pitch'] == nxt['pitch'] and (nxt_start - curr_end) < 0.2:
            fragments += 1
            
    print(f"\nTotal Overlap Violations: {violations}")
    print(f"Total Identical Fragments: {fragments}")

check_monophonic_violations(r"b:\NexusSphere\scratch\analysis_mono.json")
