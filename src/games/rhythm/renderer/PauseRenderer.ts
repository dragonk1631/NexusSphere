import { HUD_BG } from '../constants/GameConstants';

export interface PauseRenderState {
    width: number;
    height: number;
    selectedButtonIndex: number;
    animationTimer: number;
}

export class PauseRenderer {
    private readonly buttons = [
        { id: 'resume', label: 'RESUME' },
        { id: 'restart', label: 'RESTART SONG' },
        { id: 'song-select', label: 'SONG SELECTION' }
    ];

    public render(ctx: CanvasRenderingContext2D, state: PauseRenderState, alpha: number = 0): void {
        const { width, height, selectedButtonIndex, animationTimer } = state;

        // 1. Dark overlay with blur effect (simulated via alpha)
        const overlayAlpha = Math.min(0.8, animationTimer * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${overlayAlpha})`;
        ctx.fillRect(0, 0, width, height);

        // 2. Center Panel
        const panelWidth = Math.min(width * 0.8, 400);
        const panelHeight = 350;
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        const scale = 0.9 + Math.min(0.1, animationTimer * 1.5);
        ctx.scale(scale, scale);

        // Glassmorphism effect for panel
        ctx.fillStyle = HUD_BG;
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 15);
        ctx.fill();
        ctx.stroke();

        // 3. Title
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 32px "Orbitron"';
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f0ff';
        ctx.fillText("SYSTEM PAUSED", 0, -panelHeight / 2 + 50);

        // 4. Buttons
        const buttonStartY = -50;
        const buttonSpacing = 70;

        this.buttons.forEach((btn, index) => {
            const isSelected = index === selectedButtonIndex;
            const buttonY = buttonStartY + index * buttonSpacing;

            // Button Background
            ctx.fillStyle = isSelected ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
            ctx.strokeStyle = isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = isSelected ? 3 : 1;

            ctx.beginPath();
            ctx.roundRect(-panelWidth * 0.4, buttonY - 25, panelWidth * 0.8, 50, 8);
            ctx.fill();
            ctx.stroke();

            // Button Text
            ctx.font = isSelected ? 'bold 18px "Orbitron"' : '16px "Orbitron"';
            ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
            ctx.shadowBlur = isSelected ? 8 : 0;
            ctx.fillText(btn.label, 0, buttonY);
        });

        // 5. Instruction
        ctx.font = '12px "Orbitron"';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 0;
        ctx.fillText("TAP TO SELECT / PRESS ESC TO RESUME", 0, panelHeight / 2 - 30);

        ctx.restore();
    }

    public getButtonAt(x: number, y: number, width: number, height: number): number {
        const panelWidth = Math.min(width * 0.8, 400);
        const centerX = width / 2;
        const centerY = height / 2;
        const buttonStartY = centerY - 50;
        const buttonSpacing = 70;

        for (let i = 0; i < this.buttons.length; i++) {
            const bx = centerX - panelWidth * 0.4;
            const by = buttonStartY + i * buttonSpacing - 25;
            const bw = panelWidth * 0.8;
            const bh = 50;

            if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
                return i;
            }
        }
        return -1;
    }
}
