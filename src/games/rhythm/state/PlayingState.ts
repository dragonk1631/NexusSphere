import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';
import { LAYOUT } from '../constants/GameConstants';

/**
 * State handled when the game is actively being played.
 */
export class PlayingState extends BaseGameState {
    public readonly id = GameState.PLAYING;

    public update(delta: number): void {
        const game = this.game;

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

        if (game.gameplayManager.isGameOver()) {
            game.transitionSystem.start(() => {
                game.setState(GameState.GAMEOVER);
                game.audioEngine.stop();
            }, 'glitch');
        } else if (game.gameplayManager.isSongCompleted(game.lastRenderTime, game.midiData?.duration ? game.midiData.duration * 1000 : 0, delta)) {
            game.transitionSystem.start(() => {
                game.setState(GameState.RESULT);
                game.audioEngine.stop();
                if (!game.isTestMode && game.scoreManager) {
                    game.scoreManager.saveHighScore(game.menuManager.getCurrentSong().url);
                }
            }, 'fade');
        }
    }

    public render(ctx: CanvasRenderingContext2D): void {
        const game = this.game;
        const width = game.canvas.width;
        const height = game.canvas.height;

        ctx.clearRect(0, 0, width, height);
        game.updateHighwayRenderState();
        game.highwayRenderer.renderBackground(ctx, game.highwayRenderState);
        game.highwayRenderer.renderDynamic(ctx, game.highwayRenderState, game.visualNotes, game.gameplayManager.lastNoteIndex, game.gameplayManager.holdingLanes, game.inputManager);

        const hud = game.hudRenderState;
        hud.width = width;
        hud.height = height;
        hud.comboAnim = game.gameplayManager.comboAnim;
        hud.lastJudgment = game.judgmentSystem.getLastJudgment();
        hud.cachedNow = performance.now();
        hud.isMobile = game.isMobile;

        game.hudRenderer.render(ctx, hud, game.scoreManager, game.themeStrategy, (l, y) => game.getPerspectiveX(l, y));
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
