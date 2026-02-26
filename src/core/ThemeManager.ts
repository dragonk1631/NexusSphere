export interface ThemeConfig {
    id: string;
    name: string;
    pattern: string; // Background shape pattern ID
    color1: string; // Gradient Start
    color2: string; // Gradient Mid
    color3: string; // Gradient End
    particleColor: string;
    gridColor: string;
    bubblePulseGrad: string[]; // For UI bubbles like MainMenu
}

export class ThemeManager {
    private static instance: ThemeManager | null = null;
    private currentThemeId: string = 'deep-space';
    private listeners: Array<(theme: ThemeConfig) => void> = [];

    // The 10 Curated Cyber-Pop & Space Themes
    public static readonly THEMES: ThemeConfig[] = [
        {
            id: 'deep-space',
            name: 'Deep Space',
            pattern: 'stars',
            color1: '#11102A',
            color2: '#20104A',
            color3: '#3A1050',
            particleColor: 'rgba(255, 255, 255, 1)',
            gridColor: 'rgba(0, 255, 255, 0.05)',
            bubblePulseGrad: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.2)']
        },
        {
            id: 'cyber-neon',
            name: 'Cyber Neon',
            pattern: 'grid3d',
            color1: '#0B0B1A',
            color2: '#FF0055',
            color3: '#00F0FF',
            particleColor: '#00F0FF',
            gridColor: 'rgba(255, 0, 85, 0.1)',
            bubblePulseGrad: ['rgba(0, 240, 255, 0.9)', 'rgba(255, 0, 85, 0.3)']
        },
        {
            id: 'sunset-overdrive',
            name: 'Sunset Overdrive',
            pattern: 'scanlines',
            color1: '#4A154B',
            color2: '#FF416C',
            color3: '#FF4B2B',
            particleColor: '#FFD700',
            gridColor: 'rgba(255, 75, 43, 0.1)',
            bubblePulseGrad: ['rgba(255, 215, 0, 0.9)', 'rgba(255, 65, 108, 0.3)']
        },
        {
            id: 'matrix-grid',
            name: 'Matrix Grid',
            pattern: 'matrix',
            color1: '#001A00',
            color2: '#004A00',
            color3: '#000000',
            particleColor: '#00FF00',
            gridColor: 'rgba(0, 255, 0, 0.15)',
            bubblePulseGrad: ['rgba(0, 255, 0, 0.8)', 'rgba(0, 100, 0, 0.3)']
        },
        {
            id: 'vaporwave',
            name: 'Vaporwave',
            pattern: 'waves',
            color1: '#2A0845',
            color2: '#6441A5',
            color3: '#FF80CC',
            particleColor: '#00FFFF',
            gridColor: 'rgba(255, 128, 204, 0.1)',
            bubblePulseGrad: ['rgba(0, 255, 255, 0.9)', 'rgba(255, 128, 204, 0.3)']
        },
        {
            id: 'midnight-ocean',
            name: 'Midnight Ocean',
            pattern: 'bubbles',
            color1: '#000B18',
            color2: '#00425A',
            color3: '#1F8A70',
            particleColor: '#BFDB38',
            gridColor: 'rgba(31, 138, 112, 0.1)',
            bubblePulseGrad: ['rgba(191, 219, 56, 0.9)', 'rgba(0, 66, 90, 0.3)']
        },
        {
            id: 'crimson-flare',
            name: 'Crimson Flare',
            pattern: 'embers',
            color1: '#2A0000',
            color2: '#5C0000',
            color3: '#8E0000',
            particleColor: '#FFCC00',
            gridColor: 'rgba(255, 204, 0, 0.08)',
            bubblePulseGrad: ['rgba(255, 204, 0, 0.9)', 'rgba(142, 0, 0, 0.3)']
        },
        {
            id: 'golden-hour',
            name: 'Golden Hour',
            pattern: 'bokeh',
            color1: '#7B2C1B',
            color2: '#C96123',
            color3: '#FFCA3A',
            particleColor: '#FFFFFF',
            gridColor: 'rgba(255, 202, 58, 0.1)',
            bubblePulseGrad: ['rgba(255, 255, 255, 0.9)', 'rgba(201, 97, 35, 0.3)']
        },
        {
            id: 'monochrome-tech',
            name: 'Monotech',
            pattern: 'hexagons',
            color1: '#111111',
            color2: '#282828',
            color3: '#555555',
            particleColor: '#DDDDDD',
            gridColor: 'rgba(255, 255, 255, 0.05)',
            bubblePulseGrad: ['rgba(221, 221, 221, 0.9)', 'rgba(85, 85, 85, 0.3)']
        },
        {
            id: 'bubblegum-pop',
            name: 'Bubblegum',
            pattern: 'floating',
            color1: '#FF9A9E',
            color2: '#FECFEF',
            color3: '#A1C4FD',
            particleColor: '#FFFFFF',
            gridColor: 'rgba(255, 255, 255, 0.2)',
            bubblePulseGrad: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 154, 158, 0.4)']
        }
    ];

    private constructor() {
        // Load saved theme
        try {
            const saved = localStorage.getItem('nexus_global_theme');
            if (saved) {
                this.currentThemeId = saved;
            }
        } catch (e) {
            console.warn("Could not load themes", e);
        }
        this.applyToCSS();
    }

    public static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    public getCurrentTheme(): ThemeConfig {
        return ThemeManager.THEMES.find(t => t.id === this.currentThemeId) || ThemeManager.THEMES[0];
    }

    public setTheme(themeId: string): void {
        const exists = ThemeManager.THEMES.some(t => t.id === themeId);
        if (exists) {
            this.currentThemeId = themeId;
            localStorage.setItem('nexus_global_theme', this.currentThemeId);
            this.applyToCSS();
            this.notifyListeners();
        }
    }

    public getAllThemes(): ThemeConfig[] {
        return ThemeManager.THEMES;
    }

    // Subscribe to theme changes (e.g., Canvas classes that need to trigger re-renders or update gradients)
    public subscribe(listener: (theme: ThemeConfig) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        const theme = this.getCurrentTheme();
        this.listeners.forEach(listener => listener(theme));
    }

    // Write colors to CSS variables so DOM elements can use them implicitly
    private applyToCSS(): void {
        const theme = this.getCurrentTheme();
        const root = document.documentElement;
        root.style.setProperty('--theme-color1', theme.color1);
        root.style.setProperty('--theme-color2', theme.color2);
        root.style.setProperty('--theme-color3', theme.color3);
        root.style.setProperty('--theme-particle', theme.particleColor);
        root.style.setProperty('--theme-grid', theme.gridColor);
        root.style.setProperty('--theme-bubble-start', theme.bubblePulseGrad[0]);
        root.style.setProperty('--theme-bubble-end', theme.bubblePulseGrad[1]);
    }
}
