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
                ownedThemes: Array.from(this.ownedThemes)
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
                this.save();
                return;
            }

            const data = JSON.parse(dataStr);
            this.coins = data.coins || 0;
            this.jewels = data.jewels || 0;
            this.ownedThemes = new Set(data.ownedThemes || ['deep-space']);
        } catch (e) {
            console.warn("[EconomyManager] Load failed, using defaults");
            this.coins = 0;
            this.jewels = 0;
        }
    }
}
