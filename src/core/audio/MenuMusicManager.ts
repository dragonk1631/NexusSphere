import { ThemeManager } from '../ThemeManager';
import { resolveAssetPath } from '../utils/PathUtils';

export type MenuContext = 'title' | 'main' | 'options';

/**
 * MenuMusicManager - UI BGM Controller
 * 
 * Handles persistent UI BGM with theme-specific tracks and smooth cross-fading.
 */
export class MenuMusicManager {
    private static instance: MenuMusicManager;
    private currentContext: MenuContext | null = null;
    private isPlaying: boolean = false;
    private audio: HTMLAudioElement | null = null;
    private isTransitioning: boolean = false;
    private latestBgmUrl: string | null = null;

    private constructor() {
        // Subscribe to theme changes for automatic BGM switching
        ThemeManager.getInstance().subscribe((theme) => {
            if (this.isPlaying && theme.bgm) {
                this.playMusic(this.currentContext || 'main', theme.bgm);
            }
        });
    }

    public static getInstance(_audio?: any): MenuMusicManager {
        if (!MenuMusicManager.instance) {
            MenuMusicManager.instance = new MenuMusicManager();
        }
        return MenuMusicManager.instance;
    }

    private ensureAudio(url?: string): HTMLAudioElement {
        if (!this.audio) {
            const currentUrl = url || ThemeManager.getInstance().getCurrentTheme().bgm;
            if (!currentUrl) {
                console.warn("[MenuMusicManager] No BGM URL provided and no theme BGM found.");
            }
            this.audio = new Audio(currentUrl ? resolveAssetPath(currentUrl) : "");
            this.audio.loop = true;
            this.audio.volume = 0.75;
        } else if (url && !this.audio.src.includes(url)) {
            // Smoothly update source if it matches a new theme
            this.audio.src = resolveAssetPath(url);
        }
        return this.audio;
    }

    public async playMusic(context: MenuContext, themeUrl?: string): Promise<void> {
        let urlToPlay = themeUrl || ThemeManager.getInstance().getCurrentTheme().bgm;
        
        // CRITICAL: If metadata isn't loaded yet, wait for it.
        if (!urlToPlay) {
            console.log("[MenuMusicManager] BGM metadata not ready, waiting...");
            await ThemeManager.getInstance().waitForReady();
            urlToPlay = themeUrl || ThemeManager.getInstance().getCurrentTheme().bgm;
        }

        // If still no URL after waiting, handle gracefully
        if (!urlToPlay) {
            console.warn("[MenuMusicManager] No BGM URL found for current theme.");
            return;
        }

        // Avoid redundant play requests if we're already handling this URL
        if (this.latestBgmUrl === urlToPlay && this.isPlaying && !this.isTransitioning) {
            this.currentContext = context;
            return;
        }
        this.latestBgmUrl = urlToPlay;

        // If already playing the same song, just update context and ensure it's playing
        if (this.isPlaying && this.audio && this.audio.src.includes(urlToPlay)) {
            this.currentContext = context;
            if (this.audio.paused) {
                this.audio.play().catch(() => {});
            }
            return;
        }

        // If a transition is already in progress, the latestBgmUrl update above 
        // will be picked up by the 'finally' block of the existing transition.
        if (this.isTransitioning) return;

        // If switching songs while playing, handle cross-fade
        if (this.isPlaying && this.audio && urlToPlay && !this.audio.src.includes(urlToPlay)) {
            await this.crossFadeTo(urlToPlay);
            this.currentContext = context;
            return;
        }

        this.currentContext = context;
        this.isPlaying = true;

        const player = this.ensureAudio(urlToPlay);
        
        try {
            if (player.src) {
                await player.play();
                console.log(`[MenuMusicManager] Theme BGM playing for context: ${context}`);
            }
        } catch (e) {
            console.warn('[MenuMusicManager] Auto-play blocked. Will start on user gesture.');
            this.isPlaying = false;
        }
    }

    private async crossFadeTo(newUrl: string): Promise<void> {
        if (!this.audio || this.isTransitioning) return;
        this.isTransitioning = true;
        
        const player = this.audio;
        const targetVol = 0.75;
        const fadeTime = 800; 
        
        try {
            // 1. Fade OUT
            const fadeOutSteps = 15;
            const volStep = player.volume / fadeOutSteps;
            for (let i = 0; i < fadeOutSteps; i++) {
                player.volume = Math.max(0, player.volume - volStep);
                await new Promise(r => setTimeout(r, fadeTime / (fadeOutSteps * 2)));
            }
            
            player.pause();
            const resolvedUrl = resolveAssetPath(newUrl);
            player.src = resolvedUrl;
            player.load();
            
            // Wait for enough data to play, with immediate error handling for 404s/invalid paths
            await new Promise((resolve, reject) => {
                let isHandled = false;
                const onCanPlay = () => {
                    if (isHandled) return;
                    isHandled = true;
                    player.removeEventListener('canplay', onCanPlay);
                    player.removeEventListener('error', onError);
                    resolve(null);
                };
                const onError = (error: ErrorEvent) => {
                    if (isHandled) return;
                    isHandled = true;
                    player.removeEventListener('canplay', onCanPlay);
                    player.removeEventListener('error', onError);
                    reject(new Error("Source not found: " + resolvedUrl + " (Internal: " + error.message + ")"));
                };
                player.addEventListener('canplay', onCanPlay);
                player.addEventListener('error', onError);
                setTimeout(() => { if (!isHandled) onCanPlay(); }, 1500); 
            });

            await player.play();
            
            // 2. Fade IN
            const fadeInSteps = 15;
            const inStep = targetVol / fadeInSteps;
            player.volume = 0;
            for (let i = 0; i < fadeInSteps; i++) {
                player.volume = Math.min(targetVol, player.volume + inStep);
                await new Promise(r => setTimeout(r, fadeTime / (fadeInSteps * 2)));
            }
        } catch (e) {
            // Only log if it's not a standard interrupt
            if (!(e instanceof DOMException && e.name === 'AbortError')) {
                console.warn("[MenuMusicManager] Cross-fade failed for theme:", newUrl, e);
            }
            
            // FALLBACK: If the requested theme song is missing, fallback to Marchen's theme
            const marchenBgm = "assets/audio/ui/themes/marchen/정상을_향해_더_높이.mp3";
            if (newUrl !== marchenBgm && this.latestBgmUrl === newUrl) {
                console.log("[MenuMusicManager] BGM missing. Falling back to Märchen theme.");
                this.isTransitioning = false; 
                this.playMusic(this.currentContext || 'main', marchenBgm);
            }
        } finally {
            this.isTransitioning = false;
            
            // Check if the theme changed again while we were fading
            const currentThemeBgm = ThemeManager.getInstance().getCurrentTheme().bgm;
            if (currentThemeBgm && this.latestBgmUrl !== currentThemeBgm) {
                // Manually trigger the next play if it was queued during transition
                this.playMusic(this.currentContext || 'main', this.latestBgmUrl || undefined);
            }
        }
    }

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
