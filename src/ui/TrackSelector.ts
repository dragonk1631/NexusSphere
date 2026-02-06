import { UIManager } from '../core/ui/UIManager';
import type { ParsedMidi, GameTrack } from '../core/audio/MidiParser';

export class TrackSelector {
    private ui: UIManager;
    private onTrackSelected: (track: GameTrack) => void;
    private midiData: ParsedMidi;

    constructor(midiData: ParsedMidi, onTrackSelected: (track: GameTrack) => void) {
        this.ui = UIManager.getInstance();
        this.midiData = midiData;
        this.onTrackSelected = onTrackSelected;
    }

    public show(): void {
        const tracksHtml = this.midiData.tracks.map((track, index) => {
            const icon = track.isDrum ? '🥁' : '🎹';
            const count = track.noteCount;
            // Only show tracks with notes
            if (count === 0) return '';

            return `
                <div class="track-item" data-index="${index}">
                    <div class="track-info">
                        <span class="track-icon">${icon}</span>
                        <span class="track-name">${track.name}</span>
                    </div>
                    <div class="track-meta">
                        <span class="note-count">${count} Notes</span>
                        <span class="instrument">${track.instrumentFamily || 'Unknown'}</span>
                    </div>
                </div>
            `;
        }).join('');

        const html = `
            <div class="track-selector-overlay">
                <div class="track-selector-modal">
                    <h2>SELECT TRACK TO PLAY</h2>
                    <div class="track-list">
                        ${tracksHtml}
                    </div>
                    <button id="close-selector" class="cancel-btn">CANCEL</button>
                </div>
            </div>
        `;

        this.ui.createOverlay('track-selector', html);
        this.attachListeners();
    }

    private attachListeners(): void {
        const items = document.querySelectorAll('.track-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.getAttribute('data-index') || '0');
                this.selectTrack(index);
            });
        });

        document.getElementById('close-selector')?.addEventListener('click', () => {
            this.hide();
            // TODO: handle cancel
        });
    }

    private selectTrack(index: number): void {
        const track = this.midiData.tracks[index];
        this.hide();
        this.onTrackSelected(track);
    }

    public hide(): void {
        this.ui.hide('track-selector');
    }
}
