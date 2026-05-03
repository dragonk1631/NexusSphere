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
        { id: 'winter-snowflakes', name: 'Snowflakes', description: '차갑고 아름다운 결정체 모양의 눈송이 노트' },
        { id: 'pill-capsules', name: 'Pill Capsules', description: '고광택 3D 알약 캡슐 형태의 유니크한 노트' },
        { id: 'cat-face', name: 'Cat Face', description: '깜찍한 고양이 얼굴 모양의 귀여운 노트' },
        { id: 'shining-stars', name: 'Shining Stars', description: '화려하게 빛나는 5각 별 모양의 프리미엄 디자인' },
        { id: 'minimal-bars', name: 'Minimal Bars', description: '두께가 아주 얇고 세련된 와이드 가로바' },
        { id: 'crown', name: 'Crown', description: '화려하고 권위 있는 황금빛 왕관 모양의 노트' },
        { id: 'diamond-gems', name: 'Diamond Gems', description: '영롱하게 빛나는 5각형 다이아몬드 보석 노트' },
        { id: 'hologram', name: 'Hologram', description: '노이즈와 스캔라인이 잔뜩 들어간 투명 테크' },
        { id: 'heart-beats', name: 'Heart Beats', description: '사랑스럽고 입체적인 팝스타일 하트 아이콘' }
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
