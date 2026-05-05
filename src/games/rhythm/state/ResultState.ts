import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';
import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';
import { ExperienceSystem } from '../../../core/score/ExperienceSystem';
import * as PathUtils from '../../../core/utils/PathUtils';

/**
 * State handled when the player has finished a song and is viewing the result screen.
 */
export class ResultState extends BaseGameState {
    public readonly id = GameState.RESULT;
    private currentPhase: 'SCORE' | 'EXP' = 'SCORE';
    private enterTime: number = 0;
    private charImage: HTMLImageElement | null = null;

    public enter(): void {
        this.game.isNavigating = false; 
        this.currentPhase = 'SCORE';
        this.enterTime = performance.now();
        try {
            this.game.audioEngine.stopBGM(false); 
            this.game.audioEngine.playBGM(ASSET_PATHS.AUDIO.UI.RESULT, true, 0.5);

            if (this.game.scoreManager.isFullCombo()) {
                this.game.audioEngine.playSFX(ASSET_PATHS.AUDIO.UI.CHEER, 0.5);
            }
            
            // Load character image for result screen
            const charId = localStorage.getItem('nexus_active_character') || 'baby';
            this.charImage = new Image();
            this.charImage.src = PathUtils.getCharacterImagePath(charId);
        } catch (e) {
            console.warn("[ResultState] Audio playback blocked or failed:", e);
        }
    }

    public exit(): void {
        this.game.audioEngine.stopBGM(false);
    }

    public update(_delta: number): void { }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        const elapsed = performance.now() - this.enterTime;
        const currentSong = this.game.menuManager.getCurrentSong();
        const difficultyLabel = this.game.currentDifficulty || 'NORMAL';

        this.game.resultRenderer.render(
            ctx, 
            this.game.canvas.width, 
            this.game.canvas.height, 
            this.game.scoreManager, 
            currentSong, 
            alpha,
            this.currentPhase,
            elapsed,
            difficultyLabel,
            this.game.audioEngine,
            this.charImage
        );
    }

    public onKeyDown(code: string, _modifiers: { shift: boolean, alt: boolean, ctrl: boolean }): void {
        if (code === 'Enter' || code === 'Space' || code === 'Escape') {
            this.handleNavigation();
        }
    }

    public onPointerDown(_x: number, _y: number): void {
        this.handleNavigation();
    }

    private handleNavigation(): void {
        const elapsed = performance.now() - this.enterTime;

        if (this.currentPhase === 'SCORE') {
            this.currentPhase = 'EXP';
            this.enterTime = performance.now(); // Reset timer for cinematic sequencing
            // Use CHEER gently as CLICK isn't in the registry yet
            this.game.audioEngine.playSFX(ASSET_PATHS.AUDIO.UI.CHEER, 0.2);
        } else {
            // [PHASE 2] EXP & Level Up Sequence - NO SKIP allowed until finished
            const totalXP = this.game.scoreManager.getTotalXP();
            
            // Re-calculate gained XP to check for level up
            const isFC = this.game.scoreManager.isFullCombo();
            const isAP = this.game.scoreManager.getAccuracy() === 100;
            const bd = ExperienceSystem.calculateXPBreakdown(
                this.game.scoreManager.getMaxCombo(),
                this.game.scoreManager.getGrade(),
                this.game.currentDifficulty || 'NORMAL',
                isFC,
                isAP
            );
            
            const prevXP = totalXP - bd.total;
            const currentLevel = ExperienceSystem.getLevelFromXP(totalXP);
            const prevLevel = ExperienceSystem.getLevelFromXP(prevXP);
            const isLevelUp = currentLevel > prevLevel;

            // Strict Timing Calculation (Matches ResultRenderer constants)
            const rowCount = bd.achievementBonus > 0 ? 5 : 4;
            const STAGE_BAR_START = 600 + (rowCount * 300) + 400;
            const STAGE_BAR_DURATION = 2000;
            let minDuration = STAGE_BAR_START + STAGE_BAR_DURATION;
            
            if (isLevelUp) {
                // Wait for Level Up Celebration (Delay 200ms + Duration)
                minDuration += 3000; 
            }

            if (elapsed >= minDuration) {
                this.game.backToSongSelection();
            } else {
                console.log(`[ResultState] Navigation blocked: XP animation in progress (${Math.floor(elapsed)}ms / ${minDuration}ms)`);
            }
        }
    }
}
