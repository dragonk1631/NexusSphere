export interface SemanticPalette {
    /** Difficulty: EASY */
    levelEasy: string;
    /** Difficulty: NORMAL */
    levelNormal: string;
    /** Difficulty: HARD */
    levelHard: string;
    /** Difficulty: EXPERT */
    levelExpert: string;
    /** Scroll speed option accent */
    speedOption: string;
    /** Key mode option accent */
    modeOption: string;
}

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
    semantic: SemanticPalette;
}

export class ThemeManager {
    private static instance: ThemeManager | null = null;
    private currentThemeId: string = 'deep-space';
    private listeners: Array<(theme: ThemeConfig) => void> = [];

    // The 10 Curated Themes — each with a distinct identity
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
            bubblePulseGrad: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.2)'],
            semantic: {
                levelEasy: '#00d2d3',
                levelNormal: '#a29bfe',
                levelHard: '#e056a0',
                levelExpert: '#6c5ce7',
                speedOption: '#00e5ff',
                modeOption: '#e056a0',
            }
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
            bubblePulseGrad: ['rgba(0, 240, 255, 0.9)', 'rgba(255, 0, 85, 0.3)'],
            semantic: {
                levelEasy: '#00F0FF',
                levelNormal: '#7000FF',
                levelHard: '#FF0055',
                levelExpert: '#FF0000',
                speedOption: '#00F0FF',
                modeOption: '#FF0055',
            }
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
            bubblePulseGrad: ['rgba(255, 215, 0, 0.9)', 'rgba(255, 65, 108, 0.3)'],
            semantic: {
                levelEasy: '#fd79a8',
                levelNormal: '#FF8E53',
                levelHard: '#FF416C',
                levelExpert: '#8B0000',
                speedOption: '#FFD700',
                modeOption: '#FF4B2B',
            }
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
            bubblePulseGrad: ['rgba(0, 255, 0, 0.8)', 'rgba(0, 100, 0, 0.3)'],
            semantic: {
                levelEasy: '#00FF00',
                levelNormal: '#00CC66',
                levelHard: '#009933',
                levelExpert: '#006600',
                speedOption: '#88FF88',
                modeOption: '#00CC44',
            }
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
            bubblePulseGrad: ['rgba(0, 255, 255, 0.9)', 'rgba(255, 128, 204, 0.3)'],
            semantic: {
                levelEasy: '#FF80CC',   // Bubblegum pink
                levelNormal: '#b388ff', // Soft lavender
                levelHard: '#ea00d9',   // Vivid magenta
                levelExpert: '#FF00FF', // Deep neon purple
                speedOption: '#FF80CC',
                modeOption: '#b388ff',
            }
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
            bubblePulseGrad: ['rgba(191, 219, 56, 0.9)', 'rgba(0, 66, 90, 0.3)'],
            semantic: {
                levelEasy: '#64ffda',   // Aqua Teal
                levelNormal: '#4dd0e1', // Teal Cyan
                levelHard: '#1F8A70',   // Ocean Green
                levelExpert: '#004D40', // Deep Teal
                speedOption: '#4dd0e1',
                modeOption: '#64ffda',
            }
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
            bubblePulseGrad: ['rgba(255, 204, 0, 0.9)', 'rgba(142, 0, 0, 0.3)'],
            semantic: {
                levelEasy: '#FFCC00', // Flame tip (yellow)
                levelNormal: '#FF8C00', // Orange flame
                levelHard: '#FF3300', // Red-orange flame
                levelExpert: '#8B0000', // Deep ember
                speedOption: '#FFCC00',
                modeOption: '#FF6600',
            }
        },
        // Märchen replaces Golden Hour — pastel pink fairy-tale aesthetic
        {
            id: 'marchen',
            name: 'Märchen',
            pattern: 'floating',
            color1: '#2D0A2E',
            color2: '#7B3F8C',
            color3: '#F9A8D4',
            particleColor: '#FF9FBB',
            gridColor: 'rgba(249, 168, 212, 0.12)',
            bubblePulseGrad: ['rgba(255, 182, 220, 0.9)', 'rgba(123, 63, 140, 0.35)'],
            semantic: {
                levelEasy: '#f8c8da',   // Petal pink
                levelNormal: '#f48fb1', // Rose pink
                levelHard: '#e91e8c',   // Vivid fuchsia
                levelExpert: '#880e4f', // Deep magenta
                speedOption: '#f48fb1',
                modeOption: '#ce93d8',
            }
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
            bubblePulseGrad: ['rgba(221, 221, 221, 0.9)', 'rgba(85, 85, 85, 0.3)'],
            semantic: {
                levelEasy: '#DDDDDD',
                levelNormal: '#AAAAAA',
                levelHard: '#888888',
                levelExpert: '#555555',
                speedOption: '#DDDDDD',
                modeOption: '#AAAAAA',
            }
        },
        // Winter Snow replaces Bubblegum Pop — icy whites, cyans and deep navy
        {
            id: 'winter-snow',
            name: 'Winter Snow',
            pattern: 'stars',
            color1: '#05122C',
            color2: '#0A2558',
            color3: '#1A4080',
            particleColor: '#E0F7FA',
            gridColor: 'rgba(176, 230, 255, 0.07)',
            bubblePulseGrad: ['rgba(224, 247, 250, 0.9)', 'rgba(10, 37, 88, 0.3)'],
            semantic: {
                levelEasy: '#b2ebf2',   // Ice blue
                levelNormal: '#4fc3f7', // Sky cyan
                levelHard: '#0288d1',   // Arctic blue
                levelExpert: '#01579b', // Deep ice
                speedOption: '#80deea',
                modeOption: '#4fc3f7',
            }
        },
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
