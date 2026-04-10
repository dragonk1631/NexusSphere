import type { LegacyQuantizedNote } from './LegacyRhythmQuantizer';

export interface LegacyPatternSegment {
    type: 'stream' | 'burst' | 'chord' | 'single' | 'long';
    notes: LegacyQuantizedNote[];
    startTime: number;
    endTime: number;
    averageDensity: number; 
}

export class LegacyPatternAnalyzer {
    /**
     * Analyze quantized notes and group them into logical patterns.
     */
    public static analyze(notes: LegacyQuantizedNote[]): LegacyPatternSegment[] {
        if (notes.length === 0) return [];
        
        const segments: LegacyPatternSegment[] = [];
        let currentGroup: LegacyQuantizedNote[] = [notes[0]];
        
        // Phrase break threshold (960 ticks = 2 beats at 480 PPQ)
        const PHRASE_BREAK = 960; 

        for (let i = 1; i < notes.length; i++) {
            const prev = notes[i - 1];
            const curr = notes[i];
            
            if (curr.quantizedStartTick - prev.quantizedStartTick > PHRASE_BREAK) {
                segments.push(this.createSegment(currentGroup));
                currentGroup = [curr];
            } else {
                currentGroup.push(curr);
            }
        }
        
        segments.push(this.createSegment(currentGroup));
        return segments;
    }

    private static createSegment(notes: LegacyQuantizedNote[]): LegacyPatternSegment {
        const startTime = notes[0].time;
        const endTime = notes[notes.length - 1].time + notes[notes.length - 1].duration;
        const duration = endTime - startTime;
        
        let type: LegacyPatternSegment['type'] = 'single';
        if (notes.length > 4) type = 'stream';
        else if (notes.length > 1) type = 'burst';
        
        return {
            type,
            notes,
            startTime,
            endTime,
            averageDensity: notes.length / (duration || 1)
        };
    }
}
