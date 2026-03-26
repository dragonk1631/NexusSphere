import { CoreAudioEngine } from './CoreAudioEngine';
import { ASSET_PATHS } from '../asset/AssetRegistry';

export type MenuContext = 'title' | 'main' | 'options';

export class MenuMusicManager {
    private static instance: MenuMusicManager;
    private currentContext: MenuContext | null = null;
    private midiList: any[] = [];
    private isPlaying: boolean = false;
    private isAutoPaused: boolean = false;
    private audio: CoreAudioEngine | null = null;

    // Explicit URLs for contexts. If null, a random MIDI will be picked.
    private BGM_CONFIG: Record<MenuContext, string | null> = {
        'title': null,
        'main': null,
        'options': null
    };

    private constructor() {
        // Private constructor for Singleton
    }

    public static getInstance(audio?: CoreAudioEngine): MenuMusicManager {
        if (!MenuMusicManager.instance) {
            MenuMusicManager.instance = new MenuMusicManager();
        }
        if (audio) {
            MenuMusicManager.instance.audio = audio;
        }
        return MenuMusicManager.instance;
    }

    public async playMusic(context: MenuContext): Promise<void> {
        // Don't restart if already playing the correct context
        if (this.currentContext === context && this.isPlaying) return;

        this.currentContext = context;
        this.isPlaying = true;

        if (!this.audio) {
            console.error('[MenuMusicManager] Audio Engine not initialized!');
            return;
        }
        const engine = this.audio;

        try {
            // Fire and wait for initialization. If already initialized, it resolves immediately.
            await engine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);
            await engine.ensureReady();

            let midiUrl = this.BGM_CONFIG[context];

            // Fallback to random MIDI if no explicit URL is configured
            if (!midiUrl) {
                if (this.midiList.length === 0) {
                    const res = await fetch('assets/data/midi_list.json');
                    if (res.ok) {
                        this.midiList = await res.json();
                    }
                }

                if (this.midiList.length > 0) {
                    const randomFile = this.midiList[Math.floor(Math.random() * this.midiList.length)];
                    midiUrl = randomFile.url;
                }
            }

            if (!midiUrl) {
                console.warn('[MenuMusicManager] No MIDI URL resolved for context:', context);
                return;
            }

            // Await ensureReady (again just in case) and check if the context hasn't changed while fetching
            if (this.currentContext !== context || !this.isPlaying) return;

            const midiRes = await fetch(midiUrl);
            if (!midiRes.ok) throw new Error(`HTTP error! status: ${midiRes.status}`);

            const buffer = await midiRes.arrayBuffer();

            // Check context again before loading and playing
            if (this.currentContext !== context || !this.isPlaying) return;

            await engine.loadMidi(buffer);

            // Play with a subtle volume level suitable for menus (if engine supports volume control directly, otherwise let user mix master volume)
            // Currently, engine uses Synth volume. We will just play it.
            await engine.play();
            console.log(`[MenuMusicManager] Playing ${context} BGM: ${midiUrl}`);

        } catch (error) {
            console.error(`[MenuMusicManager] Failed to play BGM for context '${context}':`, error);
        }
    }

    public stopMusic(): void {
        this.currentContext = null;
        this.isPlaying = false;
        this.isAutoPaused = false;
        if (this.audio) this.audio.stop();
        console.log('[MenuMusicManager] UI BGM stopped.');
    }

    /**
     * Pauses the music if it's currently playing.
     * @param isAuto If true, marks it as auto-paused for automatic resumption.
     */
    public pauseMusic(isAuto: boolean = false): void {
        if (!this.isPlaying || !this.audio) return;
        
        this.audio.pause();
        this.isAutoPaused = isAuto;
        console.log(`[MenuMusicManager] UI BGM ${isAuto ? 'auto-' : ''}paused.`);
    }

    /**
     * Resumes the music if it was paused.
     */
    public resumeMusic(): void {
        if (!this.isPlaying || !this.audio) return;

        this.audio.play();
        this.isAutoPaused = false;
        console.log('[MenuMusicManager] UI BGM resumed.');
    }

    /**
     * Checks if the music was auto-paused and should be resumed.
     */
    public shouldResume(): boolean {
        return this.isPlaying && this.isAutoPaused;
    }
}
