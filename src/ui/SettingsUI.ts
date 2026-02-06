import { UIManager } from '../core/ui/UIManager';

/**
 * Settings Menu UI
 * Provides access to game options and the Layout Editor.
 */
export class SettingsUI {
    private ui: UIManager;
    private onAction: (action: string) => void;

    constructor(onAction: (action: string) => void) {
        this.ui = UIManager.getInstance();
        this.onAction = onAction;
    }

    public show(): void {
        const html = `
            <div class="settings-menu">
                <h1 class="settings-title">SETTINGS</h1>
                <div class="settings-section">
                    <h3>Gameplay</h3>
                    <button id="btn-layout-editor" class="settings-btn">🎨 Customize Layout</button>
                </div>
                <div class="settings-section">
                    <h3>Audio</h3>
                    <div class="setting-row">
                        <label>Master Volume</label>
                        <input type="range" id="master-volume" min="0" max="100" value="80">
                    </div>
                    <div class="setting-row">
                        <label>SFX Volume</label>
                        <input type="range" id="sfx-volume" min="0" max="100" value="100">
                    </div>
                </div>
                <button id="btn-back" class="settings-btn secondary">← Back to Menu</button>
            </div>
        `;

        this.ui.createOverlay('settings-ui', html);

        document.getElementById('btn-layout-editor')?.addEventListener('click', () => {
            this.hide();
            this.onAction('layout_editor');
        });

        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.hide();
            this.onAction('back');
        });
    }

    public hide(): void {
        this.ui.hide('settings-ui');
    }

    public destroy(): void {
        const el = document.getElementById('settings-ui');
        if (el) el.remove();
    }
}
