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
    bgm?: string;
    bgUrl?: string;
    songTitle?: string;
}

export class ThemeManager {
    private static instance: ThemeManager | null = null;
    private currentThemeId: string = 'deep-space';
    private themeSongs: Map<string, { url: string, title: string, bgUrl?: string }> = new Map();
    private initPromise: Promise<void>;
    private isReady: boolean = false;
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
            id: 'fireworks',
            name: 'Fireworks',
            pattern: 'fireworks',
            color1: '#2A0515', // Warm Deep Plum
            color2: '#FF006E', // Technika Pink (keeping color palette)
            color3: '#FFD000', // Technika Yellow/Gold
            particleColor: '#FFD000',
            gridColor: 'rgba(255, 0, 110, 0.15)',
            bubblePulseGrad: ['rgba(255, 208, 0, 0.9)', 'rgba(255, 0, 110, 0.3)'],
            semantic: {
                levelEasy: '#FFD000',
                levelNormal: '#FF006E',
                levelHard: '#FF8040',
                levelExpert: '#FFD000',
                speedOption: '#FFD000',
                modeOption: '#FF006E',
            }
        },
        {
            id: 'sunset-overdrive',
            name: 'Sunset Overdrive',
            pattern: 'sunset',
            color1: '#1A0B25', // Deep desaturated purple
            color2: '#8E4A42', // Muted Rose Gold/Crimson
            color3: '#E3C1A1', // Soft Beige/Gold Sun
            particleColor: '#DFCBBD',
            gridColor: 'rgba(142, 74, 66, 0.15)',
            bubblePulseGrad: ['rgba(227, 193, 161, 0.9)', 'rgba(142, 74, 66, 0.3)'],
            semantic: {
                levelEasy: '#E3C1A1',
                levelNormal: '#DFCBBD',
                levelHard: '#8E4A42',
                levelExpert: '#5D2E29',
                speedOption: '#E3C1A1',
                modeOption: '#8E4A42',
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
        {
            id: 'marchen',
            name: 'Märchen',
            pattern: 'floating',
            color1: '#250a1d', // Berry Midnight
            color2: '#ec407a', // Vibrant Rose Pink
            color3: '#ff80ab', // Luminous Pink
            particleColor: '#fff275', // Warm Sunlight Gold
            gridColor: 'rgba(236, 64, 122, 0.15)', // Pink tinted grid
            bubblePulseGrad: ['rgba(255, 242, 117, 0.9)', 'rgba(236, 64, 122, 0.3)'],
            semantic: {
                levelEasy: '#fff275',
                levelNormal: '#ff80ab',
                levelHard: '#ec407a',
                levelExpert: '#d81b60',
                speedOption: '#fff275',
                modeOption: '#ec407a',
            }
        },
        {
            id: 'monochrome-tech',
            name: 'Monotech',
            pattern: 'hexagons',
            color1: '#000000',
            color2: '#1a1a1a',
            color3: '#333333',
            particleColor: '#FFFFFF',
            gridColor: 'rgba(255, 255, 255, 0.1)',
            bubblePulseGrad: ['rgba(255, 255, 255, 0.8)', 'rgba(51, 51, 51, 0.3)'],
            semantic: {
                levelEasy: '#FFFFFF',
                levelNormal: '#CCCCCC',
                levelHard: '#999999',
                levelExpert: '#666666',
                speedOption: '#FFFFFF',
                modeOption: '#CCCCCC',
            }
        },
        {
            id: 'winter-snow',
            name: 'Winter Snow',
            pattern: 'snow',
            color1: '#05122C',
            color2: '#0A2558',
            color3: '#1A4080',
            particleColor: '#FFFFFF',
            gridColor: 'rgba(176, 230, 255, 0.1)',
            bubblePulseGrad: ['rgba(255, 255, 255, 0.9)', 'rgba(10, 37, 88, 0.3)'],
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
        
        // Initial load of theme songs metadata
        this.initPromise = this.loadThemeSongs();

        this.applyToCSS();
    }

    private async loadThemeSongs() {
        try {
            const res = await fetch('assets/data/theme_songs.json');
            if (res.ok) {
                const data = await res.json();
                data.forEach((item: any) => {
                    this.themeSongs.set(item.themeId, { 
                        url: item.url, 
                        title: item.songTitle,
                        bgUrl: item.bgUrl 
                    });
                });
                console.log(`[ThemeManager] Loaded ${this.themeSongs.size} theme songs.`);
                this.isReady = true;
                this.notifyListeners();
            }
        } catch (e) {
            console.warn("[ThemeManager] Failed to load theme songs metadata", e);
        }
    }

    public waitForReady(): Promise<void> {
        return this.initPromise;
    }

    public getIsReady(): boolean {
        return this.isReady;
    }

    public static getInstance(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }
        return ThemeManager.instance;
    }

    public getCurrentTheme(): ThemeConfig {
        const theme = ThemeManager.THEMES.find(t => t.id === this.currentThemeId) || ThemeManager.THEMES[0];
        const bgmInfo = this.themeSongs.get(this.currentThemeId);
        return {
            ...theme,
            bgm: bgmInfo?.url,
            bgUrl: bgmInfo?.bgUrl,
            songTitle: bgmInfo?.title
        };
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
