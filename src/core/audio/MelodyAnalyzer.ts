import type { ParsedMidi } from './MidiParser';

export class MelodyAnalyzer {
    /**
     * Analyze MIDI channels and return ranked list of melody channel candidates.
     * Uses advanced heuristics including Instrument Family, Polyphony, Pitch Variance, and Rhythmic Entropy.
     * @returns Array of channel numbers (0-15), sorted by probability (descending)
     */
    public static findMelodyChannels(midi: ParsedMidi): number[] {
        const channelStats = new Array(16).fill(0).map((_, i) => ({
            channel: i,
            noteCount: 0,
            totalPitch: 0,
            score: 0,
            nameBonus: 0,
            isDrum: i === 9,
            instrumentFamily: '',
            notes: [] as number[], // Pitch history
            intervals: [] as number[], // Rhythmic intervals
            simultaneous: 0, // Polyphony accumulator
            timestamps: [] as number[]
        }));

        console.log(`[MelodyAnalyzer] Analyzing ${midi.tracks.length} tracks for Channel-based ranking...`);

        // 1. Aggregate Data by Channel
        midi.tracks.forEach(track => {
            const ch = track.channel;
            if (ch < 0 || ch >= 16) return; // Skip invalid

            const stats = channelStats[ch];

            // Name Analysis
            const name = (track.name || "").toLowerCase();
            if (name.includes('melody') || name.includes('vocal') || name.includes('lead') || name.includes('main')) stats.nameBonus += 3000;
            else if (name.includes('piano')) stats.nameBonus += 2000;
            else if (name.includes('guitar') || name.includes('sax') || name.includes('flute') || name.includes('violin')) stats.nameBonus += 1500;
            else if (name.includes('bass')) stats.nameBonus -= 1000;
            else if (name.includes('string') || name.includes('pad') || name.includes('chorus')) stats.nameBonus -= 500;

            // Instrument Family (from Tone.js Midi)
            if (track.instrumentFamily) {
                stats.instrumentFamily = track.instrumentFamily.toLowerCase();
            }
            if (track.isDrum) stats.isDrum = true;

            // Note Aggregation
            track.notes.forEach(note => {
                stats.noteCount++;
                stats.totalPitch += note.midi;
                stats.notes.push(note.midi);
                stats.timestamps.push(note.time);
            });
        });

        // 2. Advanced Scoring
        // First, find max note count to set a threshold
        let maxNoteCount = 0;
        channelStats.forEach(s => maxNoteCount = Math.max(maxNoteCount, s.noteCount));

        // ADAPTIVE DENSITY FILTER: Lower the bar if the file is sparse.
        const densityThreshold = Math.max(30, maxNoteCount * (maxNoteCount < 300 ? 0.05 : 0.15));

        channelStats.forEach(stat => {
            if (stat.isDrum) return;

            // --- Heuristic 0: Density Filter ---
            if (stat.noteCount < densityThreshold) return;

            // --- Heuristic 1: Base Activity (Linear) ---
            let score = stat.noteCount * 1.0;

            // --- Heuristic 2: Pitch Range (Centroid) ---
            const avgPitch = stat.totalPitch / stat.noteCount;

            // LEAD RANGE (C4 - C6)
            if (avgPitch >= 60 && avgPitch <= 84) score += 2000;
            // HIGH LEAD (C6+)
            else if (avgPitch > 84) score += 1000;
            // BASS PENALTY (Below D3)
            else if (avgPitch < 50) score -= 4000;
            // LOW-MID RANGE (D3 - C4)
            else if (avgPitch < 60) score -= 1000;

            // --- Heuristic 3: Melodic Motion (Pitch Delta) ---
            // Melodies move in varied intervals. Basslines often repeat or jump large and stay.
            let pitchDeltaAvg = 0;
            if (stat.notes.length > 2) {
                let totalDelta = 0;
                let repeats = 0;
                for (let i = 1; i < stat.notes.length; i++) {
                    const delta = Math.abs(stat.notes[i] - stat.notes[i - 1]);
                    totalDelta += delta;
                    if (delta === 0) repeats++;
                }
                pitchDeltaAvg = totalDelta / (stat.notes.length - 1);
                const repeatRatio = repeats / stat.notes.length;

                // Penalty for too many repeats (Bass/Drones)
                if (repeatRatio > 0.4) score -= 1500;
                // Bonus for active melodic motion (Steps/Leaps)
                if (pitchDeltaAvg > 1.5 && pitchDeltaAvg < 7) score += 1500;
                // Penalty for extreme chaotic jumps (FX/Percussion)
                else if (pitchDeltaAvg > 12) score -= 2000;
            }

            // Variance (Standard Deviation)
            const variance = stat.notes.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / stat.noteCount;
            const stdDev = Math.sqrt(variance);
            if (stdDev > 4) score += 1000;

            // --- Heuristic 4: Polyphony & Legato ---
            stat.timestamps.sort((a, b) => a - b);
            let overlaps = 0;
            let intervals: number[] = [];
            for (let i = 1; i < stat.timestamps.length; i++) {
                const diff = stat.timestamps[i] - stat.timestamps[i - 1];
                if (Math.abs(diff) < 0.05) overlaps++;
                else intervals.push(diff);
            }
            const polyphonyRatio = overlaps / stat.noteCount;

            const fam = stat.instrumentFamily;
            const isPolyphonicInstrument = fam.includes('piano') || fam.includes('guitar') || fam.includes('chromatic') || fam.includes('organ');
            const maxAllowedPoly = isPolyphonicInstrument ? 0.6 : 0.3;

            if (polyphonyRatio > maxAllowedPoly + 0.2) score -= 3000;
            else if (polyphonyRatio > maxAllowedPoly) score -= 1000;
            else if (polyphonyRatio < 0.1) score += 1000; // Strong bonus for monophonic lead

            // --- Heuristic 5: Rhythmic Variety ---
            let entropyScore = 0;
            if (intervals.length > 10) {
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const intervalVar = intervals.reduce((s, x) => s + Math.pow(x - avgInterval, 2), 0) / intervals.length;
                const intervalStdDev = Math.sqrt(intervalVar);

                if (intervalStdDev > 0.08) {
                    entropyScore = 800;
                    score += 800;
                } else if (intervalStdDev < 0.03) {
                    entropyScore = -1000;
                    score -= 1000; // Heavy penalty for robotic static rhythm
                }
            }

            // --- Heuristic 6: Instrument Family ---
            const isHighPoly = polyphonyRatio > 0.4;
            if (fam.includes('piano') || fam.includes('chromatic')) score += 1000;
            else if (fam.includes('guitar')) {
                if (!isHighPoly) score += 1500; // Lead guitar bonus!
                else score -= 1000;
            }
            else if (fam.includes('string') || fam.includes('pad')) score -= 2000;
            else if (fam.includes('brass') || fam.includes('reed') || fam.includes('pipe')) score += 1500;

            // --- Heuristic 7: Name Bonus ---
            score += stat.nameBonus;

            stat.score = score;

            if (score > -2000) {
                console.log(`[MelodyAnalyzer] Ch ${stat.channel} (${fam || 'unknown'}): Score ${score.toFixed(0)} [N:${stat.noteCount}, Pitch:${avgPitch.toFixed(1)}, Delta:${pitchDeltaAvg.toFixed(1)}, Poly:${polyphonyRatio.toFixed(2)}, Ent:${entropyScore}]`);
            }
        });

        // 3. Sort
        const candidates = channelStats.filter(c => c.score > -5000).sort((a, b) => b.score - a.score);

        // Debug Log
        const result = candidates.slice(0, 5).map(c => c.channel);
        console.log(`[MelodyAnalyzer] Top Candidates: ${JSON.stringify(result)}`);

        // Filter Logic: Dominance
        if (candidates.length >= 2) {
            const best = candidates[0];
            const second = candidates[1];
            // INCREASED DOMINANCE RATIO: Only isolate a single channel if it's vastly superior.
            if (best.score > second.score * 2.0 || (best.score - second.score > 3000)) {
                console.log(`[MelodyAnalyzer] Dominant Winner: Channel ${best.channel}`);
                return [best.channel];
            }
        }

        return result;
    }

    /**
     * Legacy support
     */
    public static findMelodyTrack(midi: ParsedMidi): number {
        const channels = this.findMelodyChannels(midi);
        return channels.length > 0 ? channels[0] : -1;
    }
}
