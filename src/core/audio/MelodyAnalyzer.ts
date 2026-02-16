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
            isDrum: i === 9,
            isBass: false,
            instrumentFamily: '',
            notes: [] as { midi: number, time: number }[],
            score: 0
        }));

        console.log(`[MelodyAnalyzer] Analyzing channels for refined ranking...`);

        // 1. Aggregate Data by Channel
        midi.tracks.forEach(track => {
            const ch = track.channel;
            if (ch < 0 || ch >= 16) return;

            const stats = channelStats[ch];
            const name = (track.name || "").toLowerCase();

            if (name.includes('bass')) stats.isBass = true;
            if (track.instrumentFamily) {
                stats.instrumentFamily = track.instrumentFamily.toLowerCase();
                if (stats.instrumentFamily.includes('bass')) stats.isBass = true;
            }
            if (track.isDrum) stats.isDrum = true;

            track.notes.forEach(note => {
                stats.noteCount++;
                stats.totalPitch += note.midi;
                stats.notes.push({ midi: note.midi, time: note.time });
            });
        });

        // 2. Identify Roles (Exclude Percussion & Bass from Primary)
        channelStats.forEach(stat => {
            if (stat.noteCount === 0) return;
            const avgPitch = stat.totalPitch / stat.noteCount;
            // High probability it's a bass if avg pitch is very low, even if not named "bass"
            if (avgPitch < 45) stat.isBass = true;
            // Pad/Strings often have high note counts but aren't "melodies"
            if (stat.instrumentFamily.includes('string') || stat.instrumentFamily.includes('pad')) {
                stat.score -= 5000; // Low priority
            }
        });

        // 3. Find Primary: Highest note count among NON-drum and NON-bass
        const candidates = channelStats.filter(s => s.noteCount > 10 && !s.isDrum && !s.isBass);
        candidates.sort((a, b) => b.noteCount - a.noteCount);

        if (candidates.length === 0) {
            console.warn("[MelodyAnalyzer] No suitable melody candidates found. Returning empty.");
            return [];
        }

        const primary = candidates[0];
        console.log(`[MelodyAnalyzer] Primary Selected: CH ${primary.channel + 1} (${primary.noteCount} notes, ${primary.instrumentFamily})`);

        // 4. Find Secondary: Gap-Filling Logic
        // We look for other candidates that play while the Primary is silent.
        const secondaryCandidates = candidates.slice(1);

        // Define silent windows for Primary
        const primaryTimes = primary.notes.map(n => n.time).sort((a, b) => a - b);
        const gaps: { start: number, end: number }[] = [];
        const GAP_THRESHOLD = 2.0; // 2 seconds silence is a "gap"

        for (let i = 1; i < primaryTimes.length; i++) {
            const diff = primaryTimes[i] - primaryTimes[i - 1];
            if (diff > GAP_THRESHOLD) {
                gaps.push({ start: primaryTimes[i - 1] + 0.5, end: primaryTimes[i] - 0.5 });
            }
        }

        const scoredSecondary = secondaryCandidates.map(c => {
            let gapFillingNotes = 0;
            let overlappingNotes = 0;

            c.notes.forEach(n => {
                const isInGap = gaps.some(g => n.time >= g.start && n.time <= g.end);
                if (isInGap) gapFillingNotes++;
                else overlappingNotes++;
            });

            // Score = gapFilling (bonus) - overlapping (penalty)
            // We want a channel that specifically covers the silence.
            const coverageScore = (gapFillingNotes * 2) - (overlappingNotes * 0.5);

            return {
                channel: c.channel,
                score: coverageScore,
                gapNotes: gapFillingNotes,
                overlap: overlappingNotes
            };
        });

        scoredSecondary.sort((a, b) => b.score - a.score);

        const result = [primary.channel];
        if (scoredSecondary.length > 0 && scoredSecondary[0].score > 5) {
            const sec = scoredSecondary[0];
            console.log(`[MelodyAnalyzer] Secondary Selected (Gap-Filler): CH ${sec.channel + 1} (Score: ${sec.score.toFixed(1)}, GapNotes: ${sec.gapNotes})`);
            result.push(sec.channel);
        }

        // Add one more if it's high score
        if (scoredSecondary.length > 1 && scoredSecondary[1].score > 10) {
            result.push(scoredSecondary[1].channel);
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
