import { UIManager } from '../../core/ui/UIManager';
import { CoreAudioEngine } from '../../core/audio/CoreAudioEngine';

export class NoteEditor {
    private ui: UIManager;
    private audio: CoreAudioEngine;
    private isVisible: boolean = false;
    private isEditing: boolean = false;

    constructor() {
        this.ui = UIManager.getInstance();
        this.audio = CoreAudioEngine.getInstance();
    }

    public toggle(): void {
        this.isVisible = !this.isVisible;
        if (this.isVisible) this.show();
        else this.hide();
    }

    public show(): void {
        this.isEditing = true;
        this.audio.pause(); // Pause game when editing

        const html = `
            <div class="editor-overlay">
                <div class="editor-toolbar">
                    <button id="editor-play-toggle">▶ / ⏸</button>
                    <span class="editor-status">EDITOR MODE</span>
                    <button id="editor-save">SAVE</button>
                    <button id="editor-close">CLOSE</button>
                </div>
                <div class="editor-timeline">
                    <!-- Timeline visualization will be rendered via Canvas in Game Loop, 
                         this div handles UI controls -->
                </div>
                <div class="editor-instructions">
                     Click to add note, Right-click to remove. 'Space' to toggle playback.
                </div>
            </div>
        `;

        this.ui.createOverlay('note-editor', html);
        this.attachListeners();
    }

    private attachListeners(): void {
        document.getElementById('editor-close')?.addEventListener('click', () => this.hide());

        document.getElementById('editor-play-toggle')?.addEventListener('click', () => {
            // Toggle logic passed to game or handled here if simple
        });

        document.getElementById('editor-save')?.addEventListener('click', () => {
            alert("Save functionality not implemented yet (requires backend or file export)");
        });
    }

    public hide(): void {
        this.isEditing = false;
        this.ui.hide('note-editor');
        this.isVisible = false;
    }

    public isActive(): boolean {
        return this.isEditing;
    }
}
