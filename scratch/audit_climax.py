import json
import os

def audit_climax_scattering(json_path, start_s, end_s):
    if not os.path.exists(json_path): 
        print("File not found.")
        return
        
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    melody = data.get('melody', [])
    climax_notes = [n for n in melody if start_s <= n['time'] <= end_s]
    
    print(f"Notes found between {start_s}s and {end_s}s: {len(climax_notes)}")
    for n in climax_notes:
        print(f"Time: {n['time']:.2f}, Dur: {n['duration']:.2f}, Pitch: {n['pitch']}, Energy: {n['energy']:.4f}")

# Audit Sobani Irukara around 3:00 (180s)
audit_climax_scattering(r"b:\NexusSphere\scratch\sobani_audit_v28.json", 175, 190)
