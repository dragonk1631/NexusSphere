import { BaseGame } from '../../core/BaseGame';
import { CoreAudioEngine } from '../../core/audio/CoreAudioEngine';
import { UIManager } from '../../core/ui/UIManager';

/**
 * LayoutEditor - Standalone mode for customizing in-game element positions.
 * Accessible via Settings > Customize Layout.
 */
export class LayoutEditor extends BaseGame {
    private ui: UIManager;
    private elements: LayoutElement[] = [];
    private selectedElement: LayoutElement | null = null;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };

    constructor(canvas: HTMLCanvasElement, audioEngine: CoreAudioEngine) {
        super(canvas, audioEngine);
        this.ui = UIManager.getInstance();
    }

    public async init(): Promise<void> {
        console.log("[LayoutEditor] Initializing...");

        // Create UI Overlay
        const html = `
            <div class="layout-editor-panel">
                <h2>Layout Editor</h2>
                <p style="color:#888; font-size:12px;">Drag elements to reposition them.</p>
                <button id="btn-save-layout" class="layout-btn">💾 Save Layout</button>
                <button id="btn-reset-layout" class="layout-btn secondary">↺ Reset</button>
                <button id="btn-exit-layout" class="layout-btn secondary">← Exit</button>
            </div>
        `;
        this.ui.createOverlay('layout-editor-ui', html);

        document.getElementById('btn-save-layout')?.addEventListener('click', () => this.saveLayout());
        document.getElementById('btn-reset-layout')?.addEventListener('click', () => this.resetLayout());
        document.getElementById('btn-exit-layout')?.addEventListener('click', () => {
            // Signal to main.ts to return to menu
            window.dispatchEvent(new CustomEvent('layout-exit'));
        });

        // Initialize draggable elements
        this.loadLayout();
        this.setupInputListeners();
    }

    public async load(): Promise<void> {
        // No assets to load for layout editor
    }

    public create(): void {
        console.log("[LayoutEditor] Ready.");
    }

    private loadLayout(): void {
        const saved = localStorage.getItem('nexussphere_layout');
        const defaults: LayoutElement[] = [
            { id: 'hit-line', label: 'Hit Line', x: this.canvas.width / 2, y: this.canvas.height - 100, w: 400, h: 10, color: '#00ffcc' },
            { id: 'combo-display', label: 'Combo', x: this.canvas.width / 2, y: 100, w: 120, h: 50, color: '#ffcc00' },
            { id: 'score-display', label: 'Score', x: 100, y: 50, w: 150, h: 40, color: '#ff6b6b' },
            { id: 'lane-left', label: 'Lane L', x: this.canvas.width / 2 - 150, y: this.canvas.height / 2, w: 80, h: 400, color: '#4ecdc4' },
            { id: 'lane-right', label: 'Lane R', x: this.canvas.width / 2 + 150, y: this.canvas.height / 2, w: 80, h: 400, color: '#4ecdc4' },
        ];

        if (saved) {
            try {
                this.elements = JSON.parse(saved);
            } catch {
                this.elements = defaults;
            }
        } else {
            this.elements = defaults;
        }
    }

    private saveLayout(): void {
        localStorage.setItem('nexussphere_layout', JSON.stringify(this.elements));
        console.log("[LayoutEditor] Layout saved.");
        alert("Layout saved!");
    }

    private resetLayout(): void {
        localStorage.removeItem('nexussphere_layout');
        this.loadLayout();
        console.log("[LayoutEditor] Layout reset.");
    }

    private setupInputListeners(): void {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    }

    private handleMouseDown(e: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Find clicked element (reverse order for z-index)
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const el = this.elements[i];
            if (this.isInsideElement(mx, my, el)) {
                this.selectedElement = el;
                this.isDragging = true;
                this.dragOffset = { x: mx - el.x, y: my - el.y };
                return;
            }
        }
        this.selectedElement = null;
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging || !this.selectedElement) return;

        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.selectedElement.x = mx - this.dragOffset.x;
        this.selectedElement.y = my - this.dragOffset.y;
    }

    private handleMouseUp(): void {
        this.isDragging = false;
    }

    private isInsideElement(mx: number, my: number, el: LayoutElement): boolean {
        const halfW = el.w / 2;
        const halfH = el.h / 2;
        return mx >= el.x - halfW && mx <= el.x + halfW &&
            my >= el.y - halfH && my <= el.y + halfH;
    }

    public update(_delta: number): void {
        // this.render();
    }

    public render(): void {
        // Background
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Elements
        this.elements.forEach(el => {
            const isSelected = el === this.selectedElement;

            this.ctx.fillStyle = el.color + (isSelected ? 'ff' : '88');
            this.ctx.fillRect(el.x - el.w / 2, el.y - el.h / 2, el.w, el.h);

            if (isSelected) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(el.x - el.w / 2 - 2, el.y - el.h / 2 - 2, el.w + 4, el.h + 4);
            }

            // Label
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(el.label, el.x, el.y + 4);
        });

        // Instructions
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px Inter';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Click and drag elements to reposition.', 20, this.canvas.height - 20);
    }

    public destroy(): void {
        const el = document.getElementById('layout-editor-ui');
        if (el) el.remove();
        console.log("[LayoutEditor] Destroyed.");
    }
}

interface LayoutElement {
    id: string;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
}
