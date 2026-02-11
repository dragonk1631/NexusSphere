import type { ParsedMidi } from './MidiParser';

export class MelodyAnalyzer {
    /**
     * Analyze MIDI channels and return ranked list of melody channel candidates.
     * Logic adapted from BeatMaster, converted to Channel-based analysis.
     * @returns Array of channel numbers (0-15), sorted by probability (descending)
     */
    public static findMelodyChannels(midi: ParsedMidi): number[] {
        const channelStats = new Array(16).fill(0).map((_, i) => ({
            channel: i,
            noteCount: 0,
            totalPitch: 0,
            score: 0,
            nameBonus: 0,
            isDrum: i === 9 // Channel 10 (index 9) is standard drum
        }));

        console.log(`[MelodyAnalyzer] Analyzing ${midi.tracks.length} tracks for Channel-based ranking...`);

        // 1. Aggregate Data by Channel
        midi.tracks.forEach(track => {
            // Check track name for bonuses/penalties and apply to the track's channel
            // Note: A track might have multiple channels, but usually one. 
            // We'll peek at the first note's channel or the track's channel if available.
            // Tone.js Midi track.channel is valid.
            const ch = track.channel;
            if (ch >= 0 && ch < 16) {
                const name = (track.name || "").toLowerCase();
                let bonus = 0;
                if (name.includes('melody') || name.includes('vocal') || name.includes('lead') || name.includes('main')) bonus += 3000;
                else if (name.includes('piano') || name.includes('key') || name.includes('synth')) bonus += 1500;
                else if (name.includes('guitar')) bonus += 1000;
                if (name.includes('bass')) bonus -= 500;

                channelStats[ch].nameBonus += bonus;
                if (track.isDrum) channelStats[ch].isDrum = true;
            }

            // Aggregate Notes
            track.notes.forEach(note => {
                // Determine channel for this note.
                // Note objects sometimes have a channel property, or we use track channel.
                // Tone.js MIDI: note doesn't always have channel, track has it. 
                // BUT format 0 might be different. 
                // Let's rely on track.channel for now as per Parser structure.
                if (ch >= 0 && ch < 16) {
                    channelStats[ch].noteCount++;
                    channelStats[ch].totalPitch += note.midi;
                }
            });
        });

        // 2. Score Channels
        channelStats.forEach(stat => {
            if (stat.isDrum) return; // Skip drums
            if (stat.noteCount < 10) return; // Noise filter

            let score = 0;

            // Base Score: Note Count
            score += stat.noteCount;

            // Average Pitch Bonus
            const avgPitch = stat.noteCount > 0 ? stat.totalPitch / stat.noteCount : 0;
            if (avgPitch > 60) score += 500;

            // Name Bonus
            score += stat.nameBonus;

            stat.score = score;

            if (score > 0) {
                console.log(`[MelodyAnalyzer] Channel ${stat.channel}: Score ${score.toFixed(1)} (Pitch:${avgPitch.toFixed(1)}, Count:${stat.noteCount})`);
            }
        });

        // 3. Sort
        const candidates = channelStats.filter(c => c.score > 0).sort((a, b) => b.score - a.score);

        // Return channel numbers
        const result = candidates.map(c => c.channel);
        console.log(`[MelodyAnalyzer] Ranked Channels: ${JSON.stringify(result)}`);

        return result;
    }

    /**
     * Legacy support - returns best single channel
     * @returns The best channel number (0-15)
     */
    public static findMelodyTrack(midi: ParsedMidi): number {
        const channels = this.findMelodyChannels(midi);
        return channels.length > 0 ? channels[0] : -1;
    }
}
