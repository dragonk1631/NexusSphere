import { getCharacterImagePath } from '../core/utils/PathUtils';

/**
 * AvatarReaction defines the possible states/expressions for the player character.
 * Based on a 2x2 sprite sheet:
 * (0,0) - IDLE: Normal state
 * (1,0) - HAPPY: Success/Great combo
 * (0,1) - MISS: Combo break/Miss
 * (1,1) - CRY: Game over/Failure
 */
export const AvatarReaction = {
    IDLE: 'idle',
    HAPPY: 'happy',
    MISS: 'miss',
    CRY: 'cry'
} as const;

export type AvatarReaction = typeof AvatarReaction[keyof typeof AvatarReaction];

export class AvatarUI {
    private static instance: AvatarUI;
    private avatarElement: HTMLElement | null = null;
    private reactionTimeout: number | null = null;
    private currentReaction: AvatarReaction = AvatarReaction.IDLE;
    private currentCharacterAsset: string = getCharacterImagePath('baby');

    private constructor() {}

    public static getInstance(): AvatarUI {
        if (!AvatarUI.instance) {
            AvatarUI.instance = new AvatarUI();
        }
        return AvatarUI.instance;
    }

    /**
     * Creates and injects the avatar element into a target container.
     * Default location is the player HUD.
     */
    public createAvatar(containerId: string = 'avatar-container'): HTMLElement {
        const container = document.getElementById(containerId);
        if (!container) {
            const newContainer = document.createElement('div');
            newContainer.id = containerId;
            document.body.appendChild(newContainer);
        }

        const avatar = document.createElement('div');
        avatar.className = 'player-avatar avatar-idle';
        avatar.id = 'player-avatar';
        
        // Internal structure for the sprite
        avatar.innerHTML = `
            <div class="avatar-sprite" id="avatar-sprite"></div>
            <div class="avatar-glow"></div>
        `;

        this.avatarElement = avatar;
        this.injectStyles();
        
        // Load active character from storage if available
        const savedChar = localStorage.getItem('nexus_active_character') || 'baby';
        this.currentCharacterAsset = getCharacterImagePath(savedChar);
        
        const sprite = avatar.querySelector('#avatar-sprite') as HTMLElement;
        if (sprite) {
            sprite.style.backgroundImage = `url('${this.currentCharacterAsset}')`;
            sprite.classList.add(`reaction-${this.currentReaction}`);
        }

        const target = document.getElementById(containerId);
        target?.appendChild(avatar);

        return avatar;
    }

    /**
     * Updates the character asset for the active avatar.
     */
    public updateCharacter(assetId: string): void {
        this.currentCharacterAsset = getCharacterImagePath(assetId);
        const sprite = document.getElementById('avatar-sprite');
        if (sprite) {
            sprite.style.backgroundImage = `url('${this.currentCharacterAsset}')`;
        }
    }

    /**
     * Changes the avatar's expression.
     * @param reaction The new reaction state.
     * @param duration Optional time in ms to revert to IDLE.
     */
    public setReaction(reaction: AvatarReaction, duration: number = 0): void {
        if (!this.avatarElement) return;

        const sprite = document.getElementById('avatar-sprite');
        if (!sprite) return;

        // Clear existing reaction timeout
        if (this.reactionTimeout) {
            window.clearTimeout(this.reactionTimeout);
            this.reactionTimeout = null;
        }

        // Remove all reaction classes
        Object.values(AvatarReaction).forEach(r => {
            sprite.classList.remove(`reaction-${r}`);
        });

        // Add new reaction class
        sprite.classList.add(`reaction-${reaction}`);
        this.currentReaction = reaction;

        // Auto-revert to IDLE if duration is set
        if (duration > 0 && reaction !== AvatarReaction.IDLE) {
            this.reactionTimeout = window.setTimeout(() => {
                this.setReaction(AvatarReaction.IDLE);
            }, duration);
        }
    }

    private injectStyles(): void {
        if (document.getElementById('avatar-styles')) return;

        const style = document.createElement('style');
        style.id = 'avatar-styles';
        style.textContent = `
            .player-avatar {
                position: relative;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.4);
                border: 2px solid rgba(255, 255, 255, 0.2);
                overflow: hidden;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(5px);
                transition: all 0.3s ease;
            }

            .avatar-sprite {
                width: 100%;
                height: 100%;
                background-size: 200% 200%;
                background-repeat: no-repeat;
                transition: background-position 0.1s steps(1);
            }

            /* 2x2 Sprite Sheet Mapping */
            .reaction-idle  { background-position: 0% 0%; }    /* (0,0) */
            .reaction-happy { background-position: 100% 0%; }  /* (1,0) */
            .reaction-miss  { background-position: 0% 100%; }  /* (0,1) */
            .reaction-cry   { background-position: 100% 100%; } /* (1,1) */

            .avatar-glow {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.1);
                pointer-events: none;
            }

            /* Reaction Animations */
            @keyframes avatarBounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }

            .reaction-happy {
                animation: avatarBounce 0.4s ease infinite;
            }

            .reaction-miss {
                filter: saturate(0.5) brightness(0.8);
            }
        `;
        document.head.appendChild(style);
    }
}
