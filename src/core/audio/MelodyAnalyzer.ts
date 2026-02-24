import type { ParsedMidi } from './MidiParser';

interface ChannelStats {
    channel: number;
    notes: { midi: number, time: number, duration: number, velocity: number }[];
    trackNames: string[];
    instrumentFamily: string;
    isDrum: boolean;

    // Calculated Metrics
    noteCount: number;
    avgPitch: number;
    pitchStdDev: number;
    polyphonyRatio: number; // 0.0 = monophonic, 1.0 = fully polyphonic
    avgVelocity: number;
    durationEntropy: number; // Rhythmic variety
    activityRatio: number; // % of song duration covered by notes
    avgInterval: number; // Detects melodic motion vs wide jumps
    maxGap: number; // Detects phrasing

    // Final Score
    score: number;
    scoreDetails: string[]; // For debugging
}

export class MelodyAnalyzer {
    /**
     * Analyze MIDI channels and return ranked list of melody channel candidates.
     * Uses advanced heuristics including Instrument Family, Polyphony, Pitch Variance, and Rhythmic Entropy.
     * @returns Array of channel numbers (0-15), sorted by probability (descending)
     */
    public static findMelodyChannels(midi: ParsedMidi): number[] {
        console.log(`[MelodyAnalyzer] Starting Advanced Analysis (v2)...`);

        const duration = midi.duration || 180; // Default 3 mins if unknown

        // 1. Initialize Stats Containers
        const statsMap = new Map<number, ChannelStats>();
        for (let i = 0; i < 16; i++) {
            statsMap.set(i, {
                channel: i,
                notes: [],
                trackNames: [],
                instrumentFamily: 'unknown',
                isDrum: i === 9,
                noteCount: 0,
                avgPitch: 0,
                pitchStdDev: 0,
                polyphonyRatio: 0,
                avgVelocity: 0,
                durationEntropy: 0,
                activityRatio: 0,
                avgInterval: 0,
                maxGap: 0,
                score: 0,
                scoreDetails: []
            });
        }

        // 2. Aggregate Data from Tracks
        midi.tracks.forEach(track => {
            const ch = track.channel;
            if (ch < 0 || ch >= 16) return;

            const stats = statsMap.get(ch)!;

            // Collect Track Names
            if (track.name) {
                stats.trackNames.push(track.name.toLowerCase());
            }

            // Collect Instrument Info (First valid one wins, usually)
            if (track.instrumentFamily && stats.instrumentFamily === 'unknown') {
                stats.instrumentFamily = track.instrumentFamily.toLowerCase();
            }
            if (track.isDrum) stats.isDrum = true;

            // Collect Notes
            track.notes.forEach(note => {
                stats.notes.push({
                    midi: note.midi,
                    time: note.time,
                    duration: note.duration || 0.1,
                    velocity: note.velocity
                });
            });
        });

        // 3. Calculate Metrics & Compute Score
        const analyzedChannels: ChannelStats[] = [];

        statsMap.forEach(stats => {
            // Filter ghost notes early to match NoteFactory logic (threshold 13)
            stats.notes = stats.notes.filter(n => n.velocity >= 13);

            if (stats.notes.length < 5) return; // Keep low-density channels if they are clean

            // Sort notes by time for analysis
            stats.notes.sort((a, b) => a.time - b.time);

            // A. Basic Metrics
            stats.noteCount = stats.notes.length;
            const pitches = stats.notes.map(n => n.midi);
            stats.avgPitch = pitches.reduce((a, b) => a + b, 0) / stats.noteCount;
            stats.pitchStdDev = this.calculateStdDev(pitches, stats.avgPitch);

            const velocities = stats.notes.map(n => n.velocity);
            stats.avgVelocity = velocities.reduce((a, b) => a + b, 0) / stats.noteCount;

            // B. Polyphony & Gap Calculation
            let overlapFrames = 0;
            let totalInterval = 0;
            let intervalsCount = 0;
            let maxGap = 0;

            for (let i = 0; i < stats.notes.length - 1; i++) {
                const current = stats.notes[i];
                const next = stats.notes[i + 1];

                // Polyphony Check
                if (next.time < current.time + current.duration - 0.05) {
                    overlapFrames++;
                }

                // Interval Check
                if (next.time > current.time) {
                    totalInterval += Math.abs(next.midi - current.midi);
                    intervalsCount++;
                }

                // Gap Check
                const gap = next.time - (current.time + current.duration);
                if (gap > maxGap) maxGap = gap;
            }
            stats.polyphonyRatio = overlapFrames / stats.noteCount;
            stats.avgInterval = intervalsCount > 0 ? totalInterval / intervalsCount : 0;
            stats.maxGap = maxGap;

            // C. Rhythmic Entropy (Duration Variety)
            const durations = stats.notes.map(n => Math.round(n.duration * 100) / 100); // Quantize to 10ms
            const uniqueDurations = new Set(durations).size;
            stats.durationEntropy = uniqueDurations; // Simple proxy for entropy

            // D. Activity Ratio & Compute Score
            const totalNoteDuration = stats.notes.reduce((sum, n) => sum + n.duration, 0);
            stats.activityRatio = totalNoteDuration / duration;

            this.computeScore(stats);

            // IGNORE DRUMS & PERCUSSION completely for melody analysis
            if (stats.isDrum || stats.instrumentFamily.includes('percussion') || stats.instrumentFamily.includes('drum')) {
                return;
            }

            analyzedChannels.push(stats);
        });

        // 3.5. First Principle: "Most Notes = Likely Melody" (User Request)
        // Find the candidate with the absolute highest note count (excluding Drums)
        let maxNoteCount = -1;
        let maxNoteCandidate: ChannelStats | null = null;

        analyzedChannels.forEach(c => {
            // Only exclude explicit drum channels. We let low-pitch melodies compete.
            if (!c.isDrum) {
                if (c.noteCount > maxNoteCount) {
                    maxNoteCount = c.noteCount;
                    maxNoteCandidate = c;
                }
            }
        });

        // Apply a massive bonus to maximize probability, but ONLY if it has a meaningful number of notes
        // and isn't explicitly named as a bass track.
        if (maxNoteCandidate && maxNoteCount > 20) {
            const isExplicitBass = /bass/.test((maxNoteCandidate as ChannelStats).instrumentFamily);
            if (!isExplicitBass) {
                (maxNoteCandidate as ChannelStats).score += 1500;
                (maxNoteCandidate as ChannelStats).scoreDetails.push("FirstPrinciple(MostNotes) +1500");
            }
        }

        // 4. Group by Type and Sort
        const nonDrums = analyzedChannels.filter(c => !c.isDrum).sort((a, b) => b.score - a.score);
        const drums = analyzedChannels.filter(c => c.isDrum).sort((a, b) => b.score - a.score);

        // 5. Build Hierarchical Result (Melody 1 -> 2 -> 3 -> Drums)
        const result: number[] = [];

        // Top candidates (increased for better gap filling)
        for (let i = 0; i < Math.min(nonDrums.length, 8); i++) {
            result.push(nonDrums[i].channel);
        }

        // Best Drum Channel (as fallback)
        if (drums.length > 0) {
            result.push(drums[0].channel);
        }

        // Debug Output
        console.log(`[Ranked Channels] Melodies: ${nonDrums.map(c => c.channel + 1)}, Drums: ${drums.map(c => c.channel + 1)}`);
        console.log(`[Final hierarchy] ${result.map(c => c + 1)}`);

        return result;
    }

    private static computeScore(stats: ChannelStats): void {
        let score = 0;
        const details: string[] = [];

        // 1. Track Name Bonus (Huge Weight)
        const combinedName = stats.trackNames.join(' ');
        if (/melody|vocal|main|lead|voice|chorus|hook/.test(combinedName)) {
            score += 2000;
            details.push("Name(Melody) +2000");
        } else if (/bass|drum|pero|hihat|kick|snare|bgm|chord/.test(combinedName)) {
            score -= 2000;
            details.push("Name(Bg) -2000");
        }

        // 2. Instrument Family
        if (stats.isDrum) { // Channel 10 or Percussion
            score -= 3000;
            details.push("IsDrum -3000");
        } else if (/bass/.test(stats.instrumentFamily) || stats.avgPitch < 35) {
            score -= 1000;
            details.push("IsBass -1000");
        } else if (/lead|sax|trumpet|flute|oboe|clarinet|distortion|overdrive|singing/.test(stats.instrumentFamily)) {
            score += 800;
            details.push("Inst(Lead) +800");
        } else if (/piano|guitar|organ/.test(stats.instrumentFamily)) {
            score += 300;
            details.push("Inst(Poly) +300");
        } else if (/pad|string|ensemble|effects/.test(stats.instrumentFamily)) {
            score -= 500;
            details.push("Inst(Bg) -500");
        }

        // 3. Polyphony (Strong Indicator of Accompaniment)
        // Melodies are usually monophonic (ratio < 0.1)
        if (stats.polyphonyRatio > 0.45) {
            score -= 1500; // Likely Chords/Pads
            details.push(`Polyphony(${stats.polyphonyRatio.toFixed(2)}) -1500`);
        } else if (stats.polyphonyRatio > 0.2) {
            score -= 500;
            details.push("Poly(Mid) -500");
        } else {
            score += 500;
            details.push("Mono +500");
        }

        // 4. Pitch Variance (Melodies move around)
        if (stats.pitchStdDev < 3) { // Monotonous
            score -= 500;
            details.push("FlatPitch -500");
        } else if (stats.pitchStdDev > 20) { // Jumping too much (likely arpeggio accompaniment)
            score -= 500;
            details.push("WidePitch -500");
        } else {
            score += 200;
            details.push("GoodPitchRange +200");
        }

        // 5. Note Count Sweet Spot (Updated Phase 3)
        // Melodies need enough density to be playable.
        if (stats.noteCount < 100) {
            score -= 1000; // Too few notes for a rhythm game
            details.push(`LowNoteCount(${stats.noteCount}) -1000`);
        } else if (stats.noteCount >= 200 && stats.noteCount <= 1200) {
            score += 500; // Optimal range
            details.push("OptimalNoteCount +500");
        } else if (stats.noteCount > 2000) {
            score -= 500; // Too spammy (trills, arpeggios)
            details.push("Spammy -500");
        }

        // 6. Rhythmic Variety
        if (stats.durationEntropy > 5) {
            score += 300;
            details.push("RhythmicVar +300");
        } else {
            score -= 200; // Robotically uniform
            details.push("Robotic -200");
        }

        // 7. Activity Ratio (Melodies usually cover 20-80% of the song)
        if (stats.activityRatio > 0.2 && stats.activityRatio < 0.8) {
            score += 200;
            details.push(`Activity(${stats.activityRatio.toFixed(2)}) +200`);
        } else if (stats.activityRatio < 0.1) {
            score -= 500; // Too sparse
            details.push("Sparse -500");
        }

        // 8. Velocity (Louder is likely Main)
        if (stats.avgVelocity > 95) {
            score += 300;
            details.push(`HighSustain(${Math.round(stats.avgVelocity)}) +300`);
        } else if (stats.avgVelocity < 60) {
            score -= 300;
            details.push("Quiet -300");
        }

        // 9. Phrasing (Human melodies breathe)
        // If the track never stops for more than 0.5s, it's likely a mechanical loop
        if (stats.maxGap > 2.0) {
            score += 200; // Has phrasing/breathing room
            details.push("Phrasing +200");
        } else if (stats.maxGap < 0.3) {
            score -= 400; // Continuous stream (machine gun)
            details.push("NoBreaks -400");
        }

        // 10. Track Priority (Earlier tracks often main)
        if (stats.channel <= 3) {
            score += 100;
            details.push("EarlyTrack +100");
        }

        // 11. Melodic Motion (Small intervals = likely melody)
        if (stats.avgInterval >= 1 && stats.avgInterval <= 4) {
            score += 500;
            details.push(`MelodicMotion(${stats.avgInterval.toFixed(1)}) +500`);
        } else if (stats.avgInterval > 12) {
            score -= 500; // Likely arpeggiated accompaniment
            details.push(`ExtremeJumps(${stats.avgInterval.toFixed(1)}) -500`);
        }

        stats.score = score;
        stats.scoreDetails = details;
    }

    private static calculateStdDev(values: number[], mean: number): number {
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * Detects if the track is primarily composed of repeating interval patterns (Arpeggios).
     */
    /**
     * Legacy support
     */
    public static findMelodyTrack(midi: ParsedMidi): number {
        const channels = this.findMelodyChannels(midi);
        return channels.length > 0 ? channels[0] : -1;
    }

    /**
     * Intelligent Gap-Filling Strategy:
     * 1. Pick a global Primary Channel (Main melody).
     * 2. For each measure, if the Main Channel has no notes, 
     *    find the best available candidate that HAS notes in that specific measure.
     * @returns Map<measureIndex, channelIndex>
     */
    public static suggestGapFilling(midi: ParsedMidi): Map<number, number> {
        const config = new Map<number, number>();

        // Use a deeper pool for gap filling (top 8 candidates instead of top 3)
        const ranked = this.findMelodyChannels(midi);
        if (ranked.length === 0) return config;

        const mainChannel = ranked[0];
        const ppq = midi.ppq || 480;
        const totalTicks = (midi as any).durationTicks || 0;
        const totalMeasures = Math.ceil(totalTicks / (ppq * 4));

        // Group all notes by channel and measure for fast lookup
        const channelMeasureMap = new Map<number, Set<number>>(); // Map<channel, Set<measureIdx>>

        midi.tracks.forEach(track => {
            const ch = track.channel;
            if (!channelMeasureMap.has(ch)) channelMeasureMap.set(ch, new Set());
            const measureSet = channelMeasureMap.get(ch)!;

            track.notes.forEach(note => {
                if (note.velocity < 13) return; // Ignore ghosts
                const mIdx = Math.floor(note.ticks / (ppq * 4));
                measureSet.add(mIdx);
            });
        });

        // Then, analyze transitions
        // FIX: Always set measure 0 to mainChannel to provide a root for inheritance
        let currentAssignedChannel = mainChannel;
        config.set(0, mainChannel);

        for (let m = 0; m < totalMeasures; m++) {
            const mainHasNotes = channelMeasureMap.get(mainChannel)?.has(m);

            if (mainHasNotes) {
                // Return to main channel if it has content
                if (currentAssignedChannel !== mainChannel) {
                    config.set(m, mainChannel);
                    currentAssignedChannel = mainChannel;
                }
            } else {
                // Gap detected! Find a candidate from ranked list that HAS notes here
                let bestAlt: number | null = null;
                for (let i = 1; i < ranked.length; i++) {
                    const altCh = ranked[i];
                    if (channelMeasureMap.get(altCh)?.has(m)) {
                        bestAlt = altCh;
                        break;
                    }
                }

                if (bestAlt !== null && bestAlt !== currentAssignedChannel) {
                    config.set(m, bestAlt);
                    currentAssignedChannel = bestAlt;
                }
            }
        }

        return config;
    }
}
