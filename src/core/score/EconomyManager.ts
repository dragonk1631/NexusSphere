import { AuthService } from '../../services/auth/AuthService';

/**
 * EconomyManager - Manages in-game currency (Coins, Jewels) and owned items.
 * Initial users get 2000 Coins for testing/starter purposes.
 * [NEW] Strictly requires Login to track or use currency.
 */
export class EconomyManager {
    private static instance: EconomyManager;
    private static STORAGE_KEY = 'nexus_economy_final_v1';
    
    // Internal balance and ownership state
    private coins: number = 0;
    private jewels: number = 0;
    private ownedThemes: Set<string> = new Set(['deep-space']);
    private ownedSkins: Set<string> = new Set(['classic-gel']);
    private ownedCharacters: Set<string> = new Set(['baby']);

    private constructor() {
        this.load();
    }

    public static getInstance(): EconomyManager {
        if (!EconomyManager.instance) {
            EconomyManager.instance = new EconomyManager();
        }
        return EconomyManager.instance;
    }

    private checkAuth(): boolean {
        return AuthService.getInstance().isSignedIn();
    }

    public getCoins(): number {
        if (!this.checkAuth()) return 0;
        return this.coins;
    }

    public getJewels(): number {
        if (!this.checkAuth()) return 0;
        return this.jewels;
    }

    public addCoins(amount: number): void {
        if (!this.checkAuth()) return;
        this.coins += amount;
        this.save();
    }

    public addJewels(amount: number): void {
        if (!this.checkAuth()) return;
        this.jewels += amount;
        this.save();
    }

    public spendCoins(amount: number): boolean {
        if (!this.checkAuth()) return false;
        if (this.coins >= amount) {
            this.coins -= amount;
            this.save();
            return true;
        }
        return false;
    }

    public isThemeOwned(themeId: string): boolean {
        // Basic themes are always owned
        const defaults = ['deep-space'];
        if (defaults.includes(themeId)) return true;
        
        // Ownership also requires login normally, but we keep it check for simplicity
        if (!this.checkAuth()) return false;
        return this.ownedThemes.has(themeId);
    }

    public purchaseTheme(themeId: string, cost: number): { success: boolean, message: string } {
        if (!this.checkAuth()) {
            return { success: false, message: "로그인이 필요한 서비스입니다." };
        }

        if (this.isThemeOwned(themeId)) {
            return { success: false, message: "이미 보유중인 테마입니다." };
        }

        if (this.coins >= cost) {
            this.coins -= cost;
            this.ownedThemes.add(themeId);
            this.save();
            return { success: true, message: "구매가 완료되었습니다!" };
        } else {
            const short = cost - this.coins;
            return { success: false, message: `코인이 부족합니다. (${short.toLocaleString()} Coin 더 필요)` };
        }
    }

    public isSkinOwned(skinId: string): boolean {
        const defaults = ['classic-gel'];
        if (defaults.includes(skinId)) return true;
        if (!this.checkAuth()) return false;
        return this.ownedSkins.has(skinId);
    }

    public isCharacterOwned(charId: string): boolean {
        const defaults = ['baby'];
        if (defaults.includes(charId)) return true;
        if (!this.checkAuth()) return false;
        return this.ownedCharacters.has(charId);
    }

    public purchaseSkin(skinId: string, cost: number): { success: boolean, message: string } {
        if (!this.checkAuth()) {
            return { success: false, message: "로그인이 필요한 서비스입니다." };
        }

        if (this.isSkinOwned(skinId)) {
            return { success: false, message: "이미 보유중인 스킨입니다." };
        }

        if (this.coins >= cost) {
            this.coins -= cost;
            this.ownedSkins.add(skinId);
            this.save();
            return { success: true, message: "구매가 완료되었습니다!" };
        } else {
            const short = cost - this.coins;
            return { success: false, message: `코인이 부족합니다. (${short.toLocaleString()} Coin 더 필요)` };
        }
    }

    /**
     * [CLOUD-SYNC] Overwrite local balance with server-side totals.
     */
    public syncWithCloud(totalCoins: number, totalJewels: number): void {
        if (!this.checkAuth()) return;
        this.coins = totalCoins;
        this.jewels = totalJewels;
        this.save();
    }

    private save(): void {
        if (!this.checkAuth()) return;
        try {
            const data = {
                coins: this.coins,
                jewels: this.jewels,
                ownedThemes: Array.from(this.ownedThemes),
                ownedSkins: Array.from(this.ownedSkins),
                ownedCharacters: Array.from(this.ownedCharacters)
            };
            localStorage.setItem(EconomyManager.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error("[EconomyManager] Save failed", e);
        }
    }

    private load(): void {
        try {
            const dataStr = localStorage.getItem(EconomyManager.STORAGE_KEY);
            if (!dataStr) {
                // Initial Starter Coins (2000) for demo
                this.coins = 2000;
                this.jewels = 50;
                this.ownedThemes = new Set(['deep-space']);
                this.ownedSkins = new Set(['classic-gel']);
                this.ownedCharacters = new Set(['baby']);
                this.save();
                return;
            }

            const data = JSON.parse(dataStr);
            this.coins = data.coins || 0;
            this.jewels = data.jewels || 0;
            this.ownedThemes = new Set(data.ownedThemes || ['deep-space']);
            this.ownedSkins = new Set(data.ownedSkins || ['classic-gel']);
            this.ownedCharacters = new Set(data.ownedCharacters || ['baby']);
        } catch (e) {
            console.warn("[EconomyManager] Load failed, using defaults");
            this.coins = 0;
            this.jewels = 0;
        }
    }

    /**
     * [GOD-MODE] Forcefully sets coin balance.
     * Strictly restricted to administrators.
     */
    public adminSetCoins(amount: number): void {
        if (!AuthService.getInstance().isAdmin()) {
            console.error("[GOD-MODE] Access Denied: Administrator privileges required.");
            return;
        }
        this.coins = amount;
        this.save();
        console.log(`[GOD-MODE] Coin balance updated to ${amount}`);
    }

    /**
     * [GOD-MODE] Forcefully unlocks/locks content.
     * Strictly restricted to administrators.
     */
    public adminSetOwnership(type: 'theme' | 'skin' | 'char', id: string, owned: boolean): void {
        if (!AuthService.getInstance().isAdmin()) {
            console.error("[GOD-MODE] Access Denied: Administrator privileges required.");
            return;
        }
        let target: Set<string>;
        if (type === 'theme') target = this.ownedThemes;
        else if (type === 'skin') target = this.ownedSkins;
        else target = this.ownedCharacters;
        if (owned) {
            target.add(id);
            console.log(`[GOD-MODE] ${type} unlocked: ${id}`);
        } else {
            target.delete(id);
            console.log(`[GOD-MODE] ${type} locked: ${id}`);
        }
        this.save();
    }

    /**
     * [GOD-MODE] Resets all progress to starter defaults.
     * Strictly restricted to administrators.
     */
    public adminResetAll(): void {
        if (!AuthService.getInstance().isAdmin()) {
            console.error("[GOD-MODE] Access Denied: Administrator privileges required.");
            return;
        }
        this.coins = 2000;
        this.jewels = 50;
        this.ownedThemes = new Set(['deep-space']);
        this.ownedSkins = new Set(['classic-gel']);
        this.ownedCharacters = new Set(['baby']);
        this.save();
        console.log("[GOD-MODE] Economy reset to starter defaults.");
    }
}
