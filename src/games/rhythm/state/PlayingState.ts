import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';
import { LAYOUT } from '../constants/GameConstants';

/**
 * State handled when the game is actively being played.
 */
export class PlayingState extends BaseGameState {
    public readonly id = GameState.PLAYING;
    
    public enter(): void {
        this.game.gameplayManager.forceNextSync();
        // Do NOT play audio here. It will start after countdown in update().
    }

    public update(delta: number): void {
        const game = this.game;
        const manager = game.gameplayManager;

        // 1. Resume Countdown Logic
        if (manager.resumeCountdown > 0) {
            const prev = manager.resumeCountdown;
            manager.resumeCountdown -= delta / 1000;
            
            // Sync current time but DO NOT advance (freeze visual highway)
            game.unifiedCurrentTime = game.lastRenderTime;
            
            if (manager.resumeCountdown <= 0 && prev > 0) {
                // Countdown complete! Kickstart everything.
                game.audioEngine.play();
                manager.forceNextSync();
                // Re-anchor for absolute precision at the exact start moment
                game.audioEngine.reAnchorTime(game.audioEngine.currentTime);
            }
            
            // Still in countdown: Skip normal hardware sync and playback logic
            // VERY IMPORTANT: Pass delta=0 to manager.update so notes are perfectly still (no shaking/physics)
            manager.update(0, game.lastRenderTime, game.horizonY, game.hitLineY, game.laneBottomWidth, (l, y) => game.getPerspectiveX(l, y), (y) => game.getPerspectiveWidth(y));
            return; 
        }

        if (game.isTestMode) {
            game.gameplayManager.muteEnforceCounter++;
            if (game.gameplayManager.muteEnforceCounter >= 15) {
                game.gameplayManager.enforceMuteCompliance(game.transitionData);
                game.gameplayManager.muteEnforceCounter = 0;
            }
        }

        game.lastRenderTime = game.gameplayManager.syncTime(game.judgmentSystem.getLatency(), game.lastRenderTime, delta);
        game.unifiedCurrentTime = game.lastRenderTime;

        game.gameplayManager.update(
            delta,
            game.lastRenderTime,
            game.horizonY,
            game.hitLineY,
            game.laneBottomWidth,
            (l, y) => game.getPerspectiveX(l, y),
            (y) => game.getPerspectiveWidth(y)
        );

        if (game.transitionSystem.isActive()) return;

        if (!game.isTestMode && game.gameplayManager.isGameOver()) {
            game.audioEngine.stop();
            game.audioEngine.stopBGM(false); // Stop menu music if any
            game.audioEngine.playSFX('/assets/audio/ui/boo.mp3'); // [NEW] Immediate Booing SFX
            
            game.transitionSystem.start(() => {
                game.setState(GameState.GAMEOVER);
            }, 'glitch');
        } else if (game.gameplayManager.isSongCompleted(game.lastRenderTime, game.midiData?.duration ? game.midiData.duration * 1000 : 0, delta)) {
            // [NEW] Navigation Guard for Mobile Stability
            if (this.game.isNavigating) return;
            this.game.isNavigating = true;

            console.log("[PlayingState:Nav] Song completed detected.");
            game.audioEngine.stop();
            game.transitionSystem.start(() => {
                if (game.isTestMode) {
                    game.returnToEditor();
                } else {
                    game.setState(GameState.RESULT);
                    if (game.scoreManager) {
                        game.scoreManager.saveHighScore(game.menuManager.getCurrentSong().url);
                    }
                }
            }, 'fade');
        }
    }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        const game = this.game;
        const width = game.canvas.width;
        const height = game.canvas.height;

        // HIGH-PRECISION STILLNESS: During countdown, we force alpha to 0 locally 
        // to prevent ANY interpolation-based shaking/jittering.
        const renderAlpha = game.gameplayManager.resumeCountdown > 0 ? 0 : alpha;
        game.renderGameplay(ctx, width, height, renderAlpha);
    }

    public onKeyDown(code: string): void {
        if (code === 'Escape') {
            this.game.setState(GameState.PAUSED);
        }
    }

    public onPointerDown(x: number, y: number): void {
        const game = this.game;
        const pauseBtnSize = LAYOUT.PAUSE_BTN_SIZE;
        const pauseBtnX = game.canvas.width - LAYOUT.PAUSE_BTN_X_OFFSET;
        const pauseBtnY = LAYOUT.PAUSE_BTN_Y_OFFSET;

        if (x >= pauseBtnX && x <= pauseBtnX + pauseBtnSize && y >= pauseBtnY && y <= pauseBtnY + pauseBtnSize) {
            game.setState(GameState.PAUSED);
        }
    }
}
