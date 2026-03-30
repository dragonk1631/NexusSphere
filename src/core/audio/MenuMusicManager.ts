import { ASSET_PATHS } from '../asset/AssetRegistry';

export type MenuContext = 'title' | 'main' | 'options';

/**
 * MenuMusicManager - UI BGM Controller
 * 
 * UPDATED: Replaced random MIDI playback with persistent MP3 main theme.
 * The theme loops continuously across title, main menu, and options screens.
 * MIDI engine is left untouched; only HTMLAudio is used for this BGM.
 */
export class MenuMusicManager {
    private static instance: MenuMusicManager;
    private currentContext: MenuContext | null = null;
    private isPlaying: boolean = false;
    private audio: HTMLAudioElement | null = null;

    private constructor() {}

    public static getInstance(_audio?: any): MenuMusicManager {
        if (!MenuMusicManager.instance) {
            MenuMusicManager.instance = new MenuMusicManager();
        }
        return MenuMusicManager.instance;
    }

    private ensureAudio(): HTMLAudioElement {
        if (!this.audio) {
            this.audio = new Audio(ASSET_PATHS.AUDIO.UI.MAIN_THEME);
            this.audio.loop = true;
            this.audio.volume = 0.75;
        }
        return this.audio;
    }

    public async playMusic(context: MenuContext): Promise<void> {
        // Seamlessly continue across context changes (title -> main -> options)
        if (this.isPlaying) {
            this.currentContext = context;
            return;
        }

        this.currentContext = context;
        this.isPlaying = true;

        const player = this.ensureAudio();
        
        try {
            await player.play();
            console.log(`[MenuMusicManager] Main theme playing for context: ${context}`);
        } catch (e) {
            // Browser auto-play was blocked. Will retry on next user gesture.
            console.warn('[MenuMusicManager] Auto-play blocked. Will start on user gesture.');
            this.isPlaying = false;
        }
    }

    /**
     * Called after a confirmed user gesture (e.g. first click/tap).
     * Starts playback if it was previously blocked.
     */
    public tryUnblock(): void {
        if (!this.currentContext || this.isPlaying) return;
        const player = this.ensureAudio();
        player.play().then(() => {
            this.isPlaying = true;
            console.log('[MenuMusicManager] Unblocked and playing.');
        }).catch(() => {});
    }

    public stopMusic(): void {
        this.currentContext = null;
        this.isPlaying = false;
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        console.log('[MenuMusicManager] BGM stopped.');
    }

    public pauseMusic(isAuto: boolean = false): void {
        if (!this.audio) return;
        this.audio.pause();
        console.log(`[MenuMusicManager] BGM ${isAuto ? 'auto-' : ''}paused.`);
    }

    public resumeMusic(): void {
        if (!this.audio || !this.isPlaying) return;
        this.audio.play().catch(() => {});
        console.log('[MenuMusicManager] BGM resumed.');
    }

    public shouldResume(): boolean {
        return this.isPlaying && !!this.audio && this.audio.paused;
    }
}
