
import fs from 'fs';
import path from 'path';
import toneMidi from '@tonejs/midi';
const { Midi } = toneMidi;

// Path to MIDI file
const midiPath = path.resolve('public/assets/audio/midi/test.mid');

if (!fs.existsSync(midiPath)) {
    console.error(`MIDI file not found at: ${midiPath}`);
    process.exit(1);
}

const midiData = fs.readFileSync(midiPath);
const midi = new Midi(midiData);

console.log(`Analyzing: ${path.basename(midiPath)}`);
console.log(`Tracks: ${midi.tracks.length}`);

const channelStats: Record<number, { noteCount: number, instruments: Set<string> }> = {};

midi.tracks.forEach((track, index) => {
    const ch = track.channel;
    if (!channelStats[ch]) {
        channelStats[ch] = { noteCount: 0, instruments: new Set() };
    }

    channelStats[ch].noteCount += track.notes.length;
    if (track.instrument.name) {
        channelStats[ch].instruments.add(track.instrument.name);
    } else if (track.instrument.family) {
        channelStats[ch].instruments.add(track.instrument.family);
    }

    if (track.notes.length > 0) {
        console.log(`Track ${index}: Channel ${ch}, Notes: ${track.notes.length}, Instrument: ${track.instrument.name || track.instrument.family}`);
    }
});

console.log('\n--- Channel Summary ---');
Object.keys(channelStats).sort((a, b) => Number(a) - Number(b)).forEach(ch => {
    const stats = channelStats[Number(ch)];
    console.log(`Channel ${ch}: ${stats.noteCount} notes. Instruments: ${Array.from(stats.instruments).join(', ')}`);
});
