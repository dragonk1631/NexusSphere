export class ScreenUtils {
    public static isMobile(): boolean {
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    public static isStandalone(): boolean {
        return (window.navigator as any).standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches;
    }

    public static getPixelRatio(): number {
        const isMobile = this.isMobile();
        if (isMobile) {
            // Mobile: Cap at 1.25 for battery and performance
            return Math.min(window.devicePixelRatio, 1.25);
        }
        // PC: Cap at 1.5 to prevent massive GPU load on 4K/Retina displays
        // This maintains sharpness while avoiding the 2.0+ density performance hit.
        return Math.min(window.devicePixelRatio || 1, 1.5);
    }

    public static getVirtualDimensions() {
        const isMobile = this.isMobile();
        const isPortrait = window.innerHeight > window.innerWidth;
        
        let w = window.innerWidth;
        let h = window.innerHeight;

        // If mobile and in portrait, our CSS forces rotation (swapping dimensions)
        if (isMobile && isPortrait) {
            w = window.innerHeight;
            h = window.innerWidth;
        }

        // --- Resolution Capping (Optimization for High-DPI Mobile Displays) ---
        // Limit max base resolution to 1080p equivalent (e.g. 1920 long edge)
        // This is separate from DPR capping.
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;

        // Check if we need to downscale
        let scale = 1.0;
        if (w > MAX_WIDTH) scale = Math.min(scale, MAX_WIDTH / w);
        if (h > MAX_HEIGHT) scale = Math.min(scale, MAX_HEIGHT / h);

        if (scale < 1.0) {
            w = Math.round(w * scale);
            h = Math.round(h * scale);
            console.log(`[ScreenUtils] Resolution capped to ${w}x${h} (Scale: ${scale.toFixed(2)})`);
        }

        return {
            width: w,
            height: h,
            isForced: isMobile && isPortrait
        };
    }
}
