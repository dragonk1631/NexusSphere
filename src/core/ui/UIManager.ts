/**
 * UIManager - HTML Overlay Manager
 */
export class UIManager {
    private static instance: UIManager;
    private container: HTMLElement;

    private constructor() {
        this.container = document.getElementById('game-ui')!;
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'game-ui';
            this.container.style.position = 'absolute';
            this.container.style.top = '0';
            this.container.style.left = '0';
            this.container.style.width = '100%';
            this.container.style.height = '100%';
            this.container.style.pointerEvents = 'none'; // Pass clicks through by default
            document.body.appendChild(this.container);
        }
    }

    public static getInstance(): UIManager {
        if (!UIManager.instance) {
            UIManager.instance = new UIManager();
        }
        return UIManager.instance;
    }

    public createOverlay(id: string, html: string): HTMLElement {
        let el = document.getElementById(id);
        if (el) el.remove();

        el = document.createElement('div');
        el.id = id;
        el.innerHTML = html;
        el.style.pointerEvents = 'auto'; // Enable interactions
        this.container.appendChild(el);
        return el;
    }

    public show(id: string): void {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    }

    public hide(id: string): void {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    public clear(): void {
        this.container.innerHTML = '';
    }
}
