import { UIManager } from '../core/ui/UIManager';
import { SettingsUI } from './SettingsUI';

export class MainMenu {
    private ui: UIManager;
    private onStartGame: (mode: string) => void;
    private settingsUI: SettingsUI | null = null;

    constructor(onStartGame: (mode: string) => void) {
        this.ui = UIManager.getInstance();
        this.onStartGame = onStartGame;
    }

    public show(): void {
        const html = `
            <div class="main-menu">
                <h1 class="menu-title">NEXUS SPHERE</h1>
                <button id="btn-rhythm" class="menu-btn">RHYTHM MODE</button>
                <button id="btn-editor" class="menu-btn">EDITOR MODE</button>
                <button id="btn-pong" class="menu-btn">PONG MODE</button>
                <button id="btn-settings" class="menu-btn">SETTINGS</button>
            </div>
        `;

        this.ui.createOverlay('main-menu', html);

        document.getElementById('btn-rhythm')?.addEventListener('click', () => {
            this.hide();
            this.onStartGame('rhythm');
        });

        document.getElementById('btn-editor')?.addEventListener('click', () => {
            this.hide();
            this.onStartGame('editor');
        });

        document.getElementById('btn-pong')?.addEventListener('click', () => {
            this.hide();
            this.onStartGame('pong');
        });

        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this.hide();
            this.showSettings();
        });
    }

    private showSettings(): void {
        this.settingsUI = new SettingsUI((action) => {
            if (action === 'layout_editor') {
                this.settingsUI?.destroy();
                this.onStartGame('layout_editor');
            } else if (action === 'back') {
                this.settingsUI?.destroy();
                this.show();
            }
        });
        this.settingsUI.show();
    }

    public hide(): void {
        this.ui.hide('main-menu');
    }
}

