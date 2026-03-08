import { UIManager } from '../core/ui/UIManager';
import { CoreAudioEngine } from '../core/audio/CoreAudioEngine';
import type { ParsedMidi } from '../core/audio/MidiParser';

export class TrackMixer {
    private ui: UIManager;
    private audio: CoreAudioEngine;
    private midiData: ParsedMidi;
    private isVisible: boolean = false;

    constructor(midiData: ParsedMidi, audio: CoreAudioEngine) {
        this.ui = UIManager.getInstance();
        this.audio = audio;
        this.midiData = midiData;
    }

    public toggle(): void {
        if (this.isVisible) this.hide();
        else this.show();
    }

    public show(): void {
        const tracksHtml = this.midiData.tracks.map((track, index) => {
            if (track.noteCount === 0) return ''; // Skip empty tracks
            const isMuted = false; // TODO: Get actual state if possible
            return `
                <div class="mixer-track">
                    <div class="mixer-label" title="${track.name}">
                        ${index}. ${track.name.substring(0, 10)}...
                    </div>
                    <input type="range" min="0" max="127" value="100" class="vol-slider" data-channel="${track.channel}">
                    <button class="mute-btn ${isMuted ? 'active' : ''}" data-channel="${track.channel}">M</button>
                    <button class="solo-btn" data-channel="${track.channel}">S</button>
                </div>
            `;
        }).join('');

        const html = `
            <div class="mixer-panel">
                <div class="mixer-header">
                    <h3>Review Tracks</h3>
                    <button id="close-mixer">X</button>
                </div>
                <div class="mixer-content">
                    ${tracksHtml}
                </div>
            </div>
        `;

        this.ui.createOverlay('track-mixer', html);
        this.attachListeners();
        this.isVisible = true;
    }

    private attachListeners(): void {
        document.getElementById('close-mixer')?.addEventListener('click', () => this.hide());

        // Volume Sliders
        const sliders = document.querySelectorAll('.vol-slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const channel = parseInt(target.getAttribute('data-channel') || '0');
                const vol = parseInt(target.value);
                this.audio.setChannelVolume(channel, vol);
            });
        });

        // Mute Buttons
        const mutes = document.querySelectorAll('.mute-btn');
        mutes.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const channel = parseInt(target.getAttribute('data-channel') || '0');
                target.classList.toggle('active');
                const isMuted = target.classList.contains('active');
                this.audio.setChannelVolume(channel, isMuted ? 0 : 100);
            });
        });

        // Solo Buttons (Simple implementation: Mute others)
        // Note: Real solo logic requires keeping track of previous volumes, simplified for now
        const solos = document.querySelectorAll('.solo-btn');
        solos.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const channel = parseInt(target.getAttribute('data-channel') || '0');

                // Reset all first
                this.audio.setMasterVolume(0);
                // Unmute solo target
                this.audio.setChannelVolume(channel, 127);
            });
        });
    }

    public hide(): void {
        this.ui.hide('track-mixer');
        this.isVisible = false;
    }
}
