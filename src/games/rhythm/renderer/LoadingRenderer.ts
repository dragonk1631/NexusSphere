import { type SongEntry } from '../types/GameTypes';

export interface LoadingRenderState {
    width: number;
    height: number;
    progress: number; // 0.0 to 1.0
    song: SongEntry | null;
    statusText: string;
    cachedNow: number;
}

/**
 * LoadingRenderer: A premium loading screen for the rhythm game.
 * It provides visual feedback during asset preparation and engine warming.
 */
export class LoadingRenderer {
    public render(ctx: CanvasRenderingContext2D, state: LoadingRenderState, _alpha: number = 0): void {
        const { width, height, progress, song, statusText, cachedNow } = state;

        // Background: Deep dark gradient
        const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
        bgGrad.addColorStop(0, '#0a0a1a');
        bgGrad.addColorStop(1, '#020205');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Center Pulsing Orb
        this.renderPulsingOrb(ctx, width / 2, height / 2, progress, cachedNow);

        // Progress Bar
        this.renderProgressBar(ctx, width / 2, height / 2 + 150, 400, 4, progress);

        // Text Information
        ctx.textAlign = 'center';

        // Status Text (Enhanced with Pulse and Glow)
        const textPulse = Math.sin(cachedNow / 300) * 0.2 + 0.8;
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * textPulse})`;
        ctx.font = 'bold 20px "Orbitron"';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 229, 255, 0.6)';
        ctx.fillText(statusText.toUpperCase(), width / 2, height / 2 + 180);
        ctx.restore();

        // Song Info
        if (song) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px "Orbitron"';
            ctx.fillText(song.name.toUpperCase(), width / 2, height / 2 + 240);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '18px "Orbitron"';
            const artist = (song as any).artist || 'UNKNOWN ARTIST';
            ctx.fillText(artist.toUpperCase(), width / 2, height / 2 + 275);
        }

        // Percentage
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px "Orbitron"';
        ctx.fillText(`${Math.round(progress * 100)}%`, width / 2, height / 2 + 10);
    }

    private renderPulsingOrb(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, now: number): void {
        const baseRadius = 80;
        const pulse = Math.sin(now / 500) * 5;
        const radius = baseRadius + pulse;

        // Outer Glow
        const glowRad = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5);
        glowRad.addColorStop(0, 'rgba(0, 229, 255, 0.2)');
        glowRad.addColorStop(1, 'rgba(0, 229, 255, 0)');
        ctx.fillStyle = glowRad;
        ctx.beginPath();
        ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Progress Ring (Background)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Progress Ring (Active)
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
        ctx.stroke();

        // Decorative Orbits
        for (let i = 0; i < 3; i++) {
            const rot = (now / (1000 + i * 500)) * Math.PI;
            const orbitR = radius + 20 + i * 15;
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 - i * 0.03})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(x, y, orbitR, orbitR * 0.4, rot, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    private renderProgressBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, progress: number): void {
        const lx = x - w / 2;

        // Track
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(lx, y, w, h);

        // Fill
        const fillW = w * progress;
        const grad = ctx.createLinearGradient(lx, 0, lx + fillW, 0);
        grad.addColorStop(0, '#2979ff');
        grad.addColorStop(1, '#00e5ff');
        ctx.fillStyle = grad;
        ctx.fillRect(lx, y, fillW, h);

        // Particle sparks on the edge
        if (progress > 0 && progress < 1) {
            const sparkX = lx + fillW;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00e5ff';
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sparkX, y + h / 2, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}
