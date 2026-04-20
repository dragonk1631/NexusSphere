import { GameState } from '../types/GameTypes';
import { BaseGameState } from './BaseGameState';
import { MenuMusicManager } from '../../../core/audio/MenuMusicManager';

/**
 * State handled when the player is in the song selection menu.
 */
export class MenuState extends BaseGameState {
    public readonly id = GameState.MENU;

    public enter(): void {
        if (this.game.isTestMode) return;

        // Pause the main theme — song selection uses MIDI previews instead.
        // stopPreview() will call MenuMusicManager.resumeMusic() when leaving this state.
        MenuMusicManager.getInstance().pauseMusic(true);

        // Start preview for the currently highlighted song.
        this.game.menuManager.playPreview();
    }

    public exit(): void {
        // When leaving song selection, stop any active preview.
        // stopPreview() internally calls MenuMusicManager.resumeMusic() to restore the theme.
        this.game.menuManager.stopPreview();
    }

    public update(delta: number): void {
        this.game.menuManager.update(delta);
    }

    public render(ctx: CanvasRenderingContext2D, alpha: number): void {
        this.game.updateMenuRenderState();
        this.game.menuRenderer.render(ctx, this.game.menuRenderState, alpha);
    }

    public onKeyDown(code: string, _modifiers: { shift: boolean, alt: boolean, ctrl: boolean }): void {
        if (this.game.isTestMode && code === 'Enter' || code === 'Space') {
            // Logic handled in RhythmGame for now, but good to keep in mind
        }
        this.game.menuManager.handleKeyboardInput(code);
        this.game.keyMode = this.game.menuManager.getKeyMode();
    }

    public onPointerDown(x: number, y: number): void {
        this.game.menuManager.handlePointerDown(x, y, this.game.canvas.width, this.game.canvas.height, this.game.isMobile);
        this.syncSettings();
    }

    public onPointerMove(x: number, y: number): void {
        this.game.menuManager.handlePointerMove(x, y, this.game.canvas.width, this.game.canvas.height, this.game.isMobile);
    }

    public onPointerUp(_x: number, _y: number): void {
        this.game.menuManager.handlePointerUp();
        this.syncSettings();
    }

    public onWheel(delta: number): void {
        this.game.menuManager.handleWheel(delta);
    }

    private syncSettings() {
        this.game.keyMode = this.game.menuManager.getKeyMode();
        this.game.scrollSpeed = this.game.menuManager.getScrollSpeed();
        this.game.inputManager.updateKeyMode(this.game.keyMode);
    }
}
