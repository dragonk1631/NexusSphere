export interface NoteSkinConfig {
    id: string;
    name: string;
    description: string;
}

export class NoteSkinManager {
    private static instance: NoteSkinManager | null = null;
    private currentSkinId: string = 'classic-gel';
    private listeners: Array<(skin: NoteSkinConfig) => void> = [];

    // The 10 Curated Note Skins
    public static readonly SKINS: NoteSkinConfig[] = [
        { id: 'classic-gel', name: 'Classic Gel', description: '기본 라운드 반사광 젤리 노트' },
        { id: 'cyber-neon', name: 'Cyber Neon', description: '속이 빈 직사각형 형태의 강렬한 레이저 네온' },
        { id: 'retro-blocks', name: 'Retro Blocks', description: '고전 오락실 감성의 8비트 각진 블록' },
        { id: 'orb-lights', name: 'Orb Lights', description: '완벽하게 둥글고 부드러운 발광 구체' },
        { id: 'diamond-stars', name: 'Diamond Stars', description: '마름모(◇) 형태의 공격적이고 예리한 디자인' },
        { id: 'minimal-bars', name: 'Minimal Bars', description: '두께가 아주 얇고 세련된 와이드 가로바' },
        { id: 'glass-spheres', name: 'Glass Spheres', description: '입체감이 강한 반짝이는 유리구슬' },
        { id: 'laser-blades', name: 'Laser Blades', description: '양끝이 뾰족한 광선검 파편 형태' },
        { id: 'hologram', name: 'Hologram', description: '노이즈와 스캔라인이 잔뜩 들어간 투명 테크' },
        { id: 'heart-beats', name: 'Heart Beats', description: '스윗하고 팝한 하트모양 아이콘 노트' }
    ];

    private constructor() {
        // Load saved skin
        try {
            const saved = localStorage.getItem('nexus_global_note_skin');
            if (saved && NoteSkinManager.SKINS.some(s => s.id === saved)) {
                this.currentSkinId = saved;
            }
        } catch (e) {
            console.warn("Could not load note skin settings", e);
        }
    }

    public static getInstance(): NoteSkinManager {
        if (!NoteSkinManager.instance) {
            NoteSkinManager.instance = new NoteSkinManager();
        }
        return NoteSkinManager.instance;
    }

    public getCurrentSkin(): NoteSkinConfig {
        return NoteSkinManager.SKINS.find(s => s.id === this.currentSkinId) || NoteSkinManager.SKINS[0];
    }

    public setSkin(skinId: string): void {
        const exists = NoteSkinManager.SKINS.some(s => s.id === skinId);
        if (exists) {
            this.currentSkinId = skinId;
            localStorage.setItem('nexus_global_note_skin', this.currentSkinId);
            this.notifyListeners();
        }
    }

    public getAllSkins(): NoteSkinConfig[] {
        return NoteSkinManager.SKINS;
    }

    // Subscribe to skin changes to trigger RenderCache regeneration
    public subscribe(listener: (skin: NoteSkinConfig) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        const skin = this.getCurrentSkin();
        this.listeners.forEach(listener => listener(skin));
    }
}
