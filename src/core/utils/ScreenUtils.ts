export class ScreenUtils {
    public static isMobile(): boolean {
        return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    public static isStandalone(): boolean {
        return (window.navigator as any).standalone === true ||
            window.matchMedia('(display-mode: standalone)').matches;
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
        // Limit max resolution to 1080p equivalent (e.g. 1920 long edge)
        // to prevent GPU overheating on ultra-high res screens.
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
