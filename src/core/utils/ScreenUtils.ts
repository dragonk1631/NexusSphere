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

        // If mobile and in portrait, our CSS forces rotation (swapping dimensions)
        if (isMobile && isPortrait) {
            return {
                width: window.innerHeight,
                height: window.innerWidth,
                isForced: true
            };
        }

        return {
            width: window.innerWidth,
            height: window.innerHeight,
            isForced: false
        };
    }
}
