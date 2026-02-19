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
        console.log(`[MelodyAnalyzer] Starting Advanced Analysis...`);

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
            if (stats.notes.length < 10) return; // Ignore empty/noise channels

            // Sort notes by time for analysis
            stats.notes.sort((a, b) => a.time - b.time);

            // A. Basic Metrics
            stats.noteCount = stats.notes.length;
            const pitches = stats.notes.map(n => n.midi);
            stats.avgPitch = pitches.reduce((a, b) => a + b, 0) / stats.noteCount;
            stats.pitchStdDev = this.calculateStdDev(pitches, stats.avgPitch);

            // B. Polyphony (Chord Detection)
            // Count how many notes overlap significantly
            let overlapFrames = 0;
            for (let i = 0; i < stats.notes.length - 1; i++) {
                const current = stats.notes[i];
                const next = stats.notes[i + 1];
                // If next note starts before current ends (with small buffer), it's a chord/overlap
                if (next.time < current.time + current.duration - 0.05) {
                    overlapFrames++;
                }
            }
            stats.polyphonyRatio = overlapFrames / stats.noteCount;

            // C. Rhythmic Entropy (Duration Variety)
            const durations = stats.notes.map(n => Math.round(n.duration * 100) / 100); // Quantize to 10ms
            const uniqueDurations = new Set(durations).size;
            stats.durationEntropy = uniqueDurations; // Simple proxy for entropy

            // D. Activity Ratio & Compute Score
            const totalNoteDuration = stats.notes.reduce((sum, n) => sum + n.duration, 0);
            stats.activityRatio = totalNoteDuration / duration;

            this.computeScore(stats);
            analyzedChannels.push(stats);
        });

        // 4. Sort by Score
        analyzedChannels.sort((a, b) => b.score - a.score);

        // Debug Output
        analyzedChannels.slice(0, 5).forEach((c, idx) => {
            console.log(`[Rank ${idx + 1}] CH ${c.channel + 1} (${c.instrumentFamily}) Score: ${c.score}`);
            console.log(`   > ${c.scoreDetails.join(' | ')}`);
        });

        if (analyzedChannels.length === 0) {
            console.warn("[MelodyAnalyzer] No suitable channels found.");
            return [];
        }

        const primary = analyzedChannels[0];

        // 5. Gap Filling Logic (Secondary)
        // Find high-scoring channels that play when primary is silent
        const result = [primary.channel];

        const secondaryCandidates = analyzedChannels.slice(1);
        if (secondaryCandidates.length > 0) {
            const gapFiller = this.findBestGapFiller(primary, secondaryCandidates);
            if (gapFiller) {
                console.log(`[MelodyAnalyzer] Gap-Filler Selected: CH ${gapFiller.channel + 1}`);
                result.push(gapFiller.channel);
            }

            // Add a third layer if it's very distinct and high scoring
            if (secondaryCandidates.length > 2 && secondaryCandidates[1] !== gapFiller && secondaryCandidates[1].score > 1000) {
                result.push(secondaryCandidates[1].channel);
            }
        }

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
        } else if (/bass/.test(stats.instrumentFamily) || stats.avgPitch < 45) {
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
        if (stats.polyphonyRatio > 0.3) {
            score -= 1500;
            details.push(`Polyphony(${stats.polyphonyRatio.toFixed(2)}) -1500`);
        } else if (stats.polyphonyRatio > 0.1) {
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

        stats.score = score;
        stats.scoreDetails = details;
    }

    private static findBestGapFiller(primary: ChannelStats, candidates: ChannelStats[]): ChannelStats | null {
        // Define silent windows for Primary
        const primaryTimes = primary.notes.map(n => n.time);
        const gaps: { start: number, end: number }[] = [];
        const GAP_THRESHOLD = 2.0;

        for (let i = 1; i < primaryTimes.length; i++) {
            const diff = primaryTimes[i] - primaryTimes[i - 1];
            if (diff > GAP_THRESHOLD) {
                gaps.push({ start: primaryTimes[i - 1] + 0.5, end: primaryTimes[i] - 0.5 });
            }
        }

        let bestCandidate: ChannelStats | null = null;
        let bestScore = -Infinity;

        candidates.forEach(c => {
            // Must have decent musical score (not noise)
            if (c.score < -1000) return;

            let gapFillingNotes = 0;
            let overlappingNotes = 0;

            c.notes.forEach(n => {
                const isInGap = gaps.some(g => n.time >= g.start && n.time <= g.end);
                if (isInGap) gapFillingNotes++;
                else overlappingNotes++;
            });

            // Heavily reward filling gaps, penalize stepping on primary's toes
            const gapScore = (gapFillingNotes * 3) - (overlappingNotes * 1) + (c.score * 0.1);

            if (gapScore > bestScore && gapFillingNotes > 10) {
                bestScore = gapScore;
                bestCandidate = c;
            }
        });

        return bestCandidate;
    }

    private static calculateStdDev(values: number[], mean: number): number {
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(avgSquareDiff);
    }

    /**
     * Legacy support
     */
    public static findMelodyTrack(midi: ParsedMidi): number {
        const channels = this.findMelodyChannels(midi);
        return channels.length > 0 ? channels[0] : -1;
    }
}
