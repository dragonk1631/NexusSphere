import { Judgment } from '../../games/rhythm/types/GameTypes';
import { AuthService } from '../../services/auth/AuthService';
import { ApiUtils } from '../utils/ApiUtils';

export interface ScoreRecord {
    score: number;
    maxCombo: number;
    accuracy: number;
    grade: string; // S+, S, A, B, C, D, F
    timestamp: number;
    playCount?: number;
}

/**
 * [SERVER-AUTHORITATIVE ScoreManager]
 * 
 * Design Principles:
 * - LOGGED IN:  Server DB is the ONLY source of truth.
 *               localStorage is NOT used. All reads come from in-memory cache
 *               that was populated by syncWithServer() at login time.
 *               All writes go to the server first, then update the in-memory cache
 *               from the server's response.
 * 
 * - GUEST MODE: localStorage is the sole data store.
 *               No server communication. XP/Level are not tracked.
 */
export class ScoreManager {
    private static instance: ScoreManager;
    private static readonly GUEST_STORAGE_KEY = 'nexussphere_guest_data_v1';

    // --- Session State (resets each song) ---
    private currentCombo: number = 0;
    private maxCombo: number = 0;
    private score: number = 0;
    private isTestMode: boolean = false;
    private isServerDown: boolean = false;
    private liveStreak: number = 0; // Persistent streak across songs
    private currentDifficulty: string = 'NORMAL';

    // --- Progression State (from server for logged-in, from localStorage for guest) ---
    private totalXP: number = 0;
    private currentLevel: number = 1;
    private gainedXP: number = 0;
    private gainedCoin: number = 0;
    public totalCoins: number = 0;

    // --- Health System ---
    private health: number = 100;
    private maxHealth: number = 100;

    // --- Note Stats (per-session) ---
    private perfectCount: number = 0;
    private greatCount: number = 0;
    private goodCount: number = 0;
    private missCount: number = 0;
    private totalChartNotes: number = 0;

    // --- Persistent Data (in-memory cache, populated from server or localStorage) ---
    private highScores: { [recordKey: string]: ScoreRecord } = {};
    private favorites: Set<string> = new Set();
    public stats: any = null;

    private constructor() {
        // On construction, load guest data. Server data will be loaded by syncWithServer().
        this.loadGuestData();
    }

    public static getInstance(): ScoreManager {
        if (!ScoreManager.instance) {
            ScoreManager.instance = new ScoreManager();
        }
        return ScoreManager.instance;
    }

    // ===========================
    // SESSION GAMEPLAY METHODS
    // ===========================

    public setTotalNotes(count: number): void {
        this.totalChartNotes = count;
    }

    public addHit(baseScore: number = 100, judgment: Judgment = Judgment.PERFECT): void {
        if (judgment === Judgment.MISS) {
            this.missCount++;
            this.resetCombo();
            this.liveStreak = 0;
            if (!this.isTestMode) {
                // [HARDCORE DAMAGE BALANCE]
                // Easy: 5 | Normal: 6.5 | Hard: 8 | Extreme: 10
                let damageAmount = 5.0;
                if (this.currentDifficulty === 'NORMAL') damageAmount = 6.5;
                else if (this.currentDifficulty === 'HARD') damageAmount = 8.0;
                else if (this.currentDifficulty === 'EXTREME') damageAmount = 10.0;
                
                this.damage(damageAmount);
            }
            return;
        }

        this.currentCombo++;
        this.liveStreak++;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }

        if (judgment === Judgment.PERFECT) this.perfectCount++;
        else if (judgment === Judgment.GREAT) this.greatCount++;
        else if (judgment === Judgment.GOOD) this.goodCount++;

        if (!this.isTestMode) {
            this.score += baseScore * (1 + Math.min(this.currentCombo, 50) * 0.1);
            
            // [HARDCORE RECOVERY BALANCE] 
            // 1. Base recovery halved (2 -> 1)
            // 2. Difficulty Scaling (Higher difficulty = less recovery)
            let recoveryScale = 1.0;
            if (this.currentDifficulty === 'NORMAL') recoveryScale = 0.6;
            else if (this.currentDifficulty === 'HARD') recoveryScale = 0.3;
            else if (this.currentDifficulty === 'EXTREME') recoveryScale = 0.1;
            
            this.heal(1.0 * recoveryScale);
        }
    }

    public addScore(points: number): void {
        if (this.isTestMode) return;
        this.score += points;
    }

    public increaseCombo(amount: number): void {
        this.currentCombo += amount;
        this.liveStreak += amount;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }
    }

    public getAccuracy(): number {
        if (this.totalChartNotes === 0) return 0;
        const points = (this.perfectCount * 1.0) + (this.greatCount * 0.75) + (this.goodCount * 0.5);
        return (points / this.totalChartNotes) * 100;
    }

    public getGrade(): string {
        const acc = this.getAccuracy();
        const isFC = this.isFullCombo();
        const isAP = isFC && (this.perfectCount === this.totalChartNotes && this.totalChartNotes > 0);
        
        if (isAP) return 'S+';
        if (isFC) return 'S';
        if (acc > 90) return 'A';
        return 'B';
    }

    public getDetailedStats() {
        return {
            perfect: this.perfectCount,
            great: this.greatCount,
            good: this.goodCount,
            miss: this.missCount,
            total: this.totalChartNotes
        };
    }

    public damage(amount: number): void { this.health = Math.max(0, this.health - amount); }
    public heal(amount: number): void { this.health = Math.min(this.maxHealth, this.health + amount); }
    public setDifficulty(difficulty: string): void { this.currentDifficulty = difficulty || 'NORMAL'; }
    public isDead(): boolean { return this.health <= 0; }

    public getTotalXP(): number { return this.totalXP; }
    public getCurrentLevel(): number { return this.currentLevel; }
    public getLastGainedXP(): number { return this.gainedXP; }
    public getLastGainedCoin(): number { return this.gainedCoin; }
    public getHealth(): number { return this.health; }
    public getMaxHealth(): number { return this.maxHealth; }
    public getLiveStreak(): number { return this.liveStreak; }

    public resetCombo(): void { this.currentCombo = 0; }

    public reset(): void {
        this.resetCombo();
        this.maxCombo = 0;
        this.health = this.maxHealth;
        this.perfectCount = 0;
        this.greatCount = 0;
        this.goodCount = 0;
        this.missCount = 0;
        this.score = 0;
    }

    public setTestMode(enabled: boolean): void { this.isTestMode = enabled; }

    public forceFullCombo(): void {
        const total = this.totalChartNotes > 0 ? this.totalChartNotes : 500;
        this.totalChartNotes = total;
        this.perfectCount = total;
        this.greatCount = 0;
        this.goodCount = 0;
        this.missCount = 0;
        this.maxCombo = total;
        this.currentCombo = total;
        this.liveStreak += total;
        this.health = this.maxHealth;
        
        let simulatedScore = 0;
        for (let i = 1; i <= total; i++) {
            simulatedScore += 100 * (1 + Math.min(i, 50) * 0.1);
        }
        this.score = Math.floor(simulatedScore);
    }

    public getCombo(): number { return this.liveStreak; }
    public getMaxCombo(): number { return this.maxCombo; }
    public getScore(): number { return this.score; }
    public isFullCombo(): boolean { return this.missCount === 0 && this.totalChartNotes > 0; }

    // ===========================
    // SERVER SYNC (Logged-in only)
    // ===========================

    /**
     * Called on login. Fetches ALL user data from the server and 
     * overwrites the in-memory state. No localStorage involved.
     */
    public async syncWithServer(): Promise<void> {
        const auth = AuthService.getInstance();
        if (!auth.isSignedIn()) return;

        try {
            const token = await auth.getClerk()?.session?.getToken();
            if (!token) return;

            const name = auth.getUserName();
            const response = await ApiUtils.fetch(`/api/user/sync?name=${encodeURIComponent(name)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.error('[ScoreManager] Sync failed:', response.status);
                return;
            }

            const data = await response.json();
            if (!data.success) return;

            // === OVERWRITE in-memory state from server ===

            // 1. Stats (or defaults if user has never played)
            const serverStats = data.stats;
            if (serverStats) {
                this.totalXP = serverStats.exp || 0;
                this.currentLevel = serverStats.level || 1;
                this.totalCoins = serverStats.total_coins || 0;
                this.liveStreak = serverStats.current_streak || 0;
                this.stats = serverStats;
            } else {
                // User has never played — clean slate
                this.totalXP = 0;
                this.currentLevel = 1;
                this.totalCoins = 0;
                this.stats = { level: 1, exp: 0, total_score: 0, play_count: 0, total_coins: 0, max_combo: 0 };
            }

            // 2. High Scores — completely replace
            this.highScores = {};
            if (data.records && Array.isArray(data.records)) {
                data.records.forEach((r: any) => {
                    const key = `${r.song_id}:${r.key_mode}:${r.difficulty}`;
                    const acc = r.accuracy !== undefined ? r.accuracy : (r.best_accuracy || 0);
                    
                    // Dynamic Grade Calculation for V3 (or use existing best_grade)
                    let calculatedGrade = r.best_grade || 'B';
                    if (acc >= 100) calculatedGrade = 'S+';
                    else if (acc >= 95) calculatedGrade = 'S';
                    else if (acc >= 85) calculatedGrade = 'A';
                    else if (acc > 0) calculatedGrade = 'B';

                    this.highScores[key] = {
                        score: r.score !== undefined ? r.score : (r.high_score || 0),
                        maxCombo: r.max_streak !== undefined ? r.max_streak : (r.max_combo || 0),
                        accuracy: acc,
                        grade: calculatedGrade,
                        playCount: r.play_count || 1,
                        timestamp: new Date(r.last_played_at || Date.now()).getTime()
                    };
                });
            }

            // 3. Favorites — completely replace
            this.favorites = new Set(data.favorites || []);

            // 4. Economy sync
            try {
                const { EconomyManager } = await import('./EconomyManager');
                EconomyManager.getInstance().syncWithCloud(serverStats?.total_coins || 0, serverStats?.total_jewels || 0);
            } catch (e) { /* EconomyManager may not exist */ }

            console.info(`[ScoreManager] Server sync complete. Level: ${this.currentLevel}, XP: ${this.totalXP}, Records: ${Object.keys(this.highScores).length}`);
            
            // Dispatch events for UI updates
            window.dispatchEvent(new CustomEvent('nexus-favorites-synced'));
            window.dispatchEvent(new CustomEvent('nexus-stats-updated', { 
                detail: { level: this.currentLevel, exp: this.totalXP } 
            }));
        } catch (e) {
            console.error('[ScoreManager] Server sync error:', e);
        }
    }

    // ===========================
    // SCORE SUBMISSION
    // ===========================

    /**
     * Called after a song ends. 
     * - Logged in: Sends results to server, updates state from server response.
     * - Guest: Saves to localStorage only.
     */
    public async saveHighScore(songId: string, keyMode: number, difficulty: string): Promise<{ isNewRecord: boolean, gainedXP: number, gainedCoin: number }> {
        const accuracy = this.getAccuracy();
        const grade = this.getGrade();
        const isFC = this.isFullCombo();
        const isAP = isFC && (this.perfectCount === this.totalChartNotes);

        const recordKey = `${songId}:${keyMode}:${difficulty}`;
        const existing = this.highScores[recordKey];

        const newRecord: ScoreRecord = {
            score: Math.floor(this.score),
            maxCombo: this.maxCombo,
            accuracy: accuracy,
            grade: grade,
            timestamp: Date.now(),
            playCount: (existing?.playCount || 0) + 1
        };

        // Determine if this is a new best
        const gradePriority: { [key: string]: number } = { 'S+': 4, 'S': 3, 'A': 2, 'B': 1, 'F': 0 };
        const currentGradePower = gradePriority[existing?.grade || 'F'] || 0;
        const newGradePower = gradePriority[newRecord.grade] || 0;
        const isNewRecord = !existing || 
                           (newGradePower > currentGradePower) || 
                           (newGradePower === currentGradePower && newRecord.score > existing.score);

        const auth = AuthService.getInstance();

        if (auth.isSignedIn()) {
            // === ONLINE MODE: Server decides everything ===
            const result = await this.submitToServer(songId, keyMode, difficulty, newRecord, isFC, isAP);
            
            if (result) {
                // Update in-memory state from server response
                this.gainedXP = result.gainedXP;
                this.gainedCoin = result.gainedCoin;
                this.totalXP = result.stats.exp;
                this.currentLevel = result.stats.level;
                this.totalCoins = result.stats.total_coins;

                // Update local high score cache (server already persisted it)
                if (isNewRecord) {
                    this.highScores[recordKey] = newRecord;
                }

                window.dispatchEvent(new CustomEvent('nexus-stats-updated', { 
                    detail: { level: this.currentLevel, exp: this.totalXP } 
                }));

                return { isNewRecord, gainedXP: result.gainedXP, gainedCoin: result.gainedCoin };
            } else {
                // Server failed — still show something to user
                return { isNewRecord: false, gainedXP: 0, gainedCoin: 0 };
            }
        } else {
            // === GUEST MODE: Local only, no XP ===
            if (isNewRecord) {
                this.highScores[recordKey] = newRecord;
            }
            this.gainedXP = 0;
            this.gainedCoin = 0;
            this.saveGuestData();
            return { isNewRecord, gainedXP: 0, gainedCoin: 0 };
        }
    }

    /**
     * Send play results to the server. Returns server's authoritative response.
     */
    private async submitToServer(
        songId: string, keyMode: number, difficulty: string, 
        record: ScoreRecord, isFC: boolean, isAP: boolean
    ): Promise<{ gainedXP: number, gainedCoin: number, stats: any } | null> {
        if (this.isServerDown) return null;

        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();
            
            const payload = { 
                songId, keyMode, difficulty,
                score: record.score, accuracy: record.accuracy, maxCombo: record.maxCombo,
                grade: record.grade, isFC, isAP,
                perfect: this.perfectCount, great: this.greatCount, good: this.goodCount, miss: this.missCount,
                liveStreak: this.liveStreak,
                nickname: auth.getUserName(),
                avatarUrl: auth.getClerk()?.user?.imageUrl
            };

            const response = await ApiUtils.fetch('/api/scores/submit', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return {
                        gainedXP: result.gainedXP || 0,
                        gainedCoin: result.gainedCoin || 0,
                        stats: result.stats
                    };
                }
            } else {
                if (response.status === 404) this.isServerDown = true;
            }
        } catch (e) {
            console.error('[ScoreManager] Submit error:', e);
        }
        return null;
    }

    // ===========================
    // XP (display helper — does NOT calculate, just reads server data)
    // ===========================

    public updateExperience(gained: number): { levelUp: boolean } {
        // For logged-in users, this is now a no-op — server handles XP.
        // We keep it for compatibility but it only updates the display value.
        if (AuthService.getInstance().isSignedIn()) {
            // Server already updated totalXP in submitToServer response
            this.gainedXP = gained;
            return { levelUp: false };
        }
        // Guest mode: no XP tracking
        return { levelUp: false };
    }

    // ===========================
    // FAVORITES
    // ===========================

    public isFavorite(songId: string): boolean {
        return this.favorites.has(songId);
    }

    public async toggleCloudFavorite(songId: string, isFavorite: boolean): Promise<void> {
        if (isFavorite) this.favorites.add(songId);
        else this.favorites.delete(songId);

        const auth = AuthService.getInstance();
        if (!auth.isSignedIn()) {
            this.saveGuestData();
            return;
        }

        try {
            const token = await auth.getClerk()?.session?.getToken();
            if (!token) return;

            await ApiUtils.fetch('/api/user/favorites/toggle', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ songId, isFavorite })
            });
        } catch (e) {
            console.error('[ScoreManager] Failed to toggle cloud favorite:', e);
        }
    }

    // ===========================
    // DATA ACCESS
    // ===========================

    public getHighScore(songId: string, keyMode: number, difficulty: string): ScoreRecord | null {
        return this.highScores[`${songId}:${keyMode}:${difficulty}`] || null;
    }

    public getLocalArchiveData() {
        const records = Object.entries(this.highScores).map(([key, r]) => {
            const [song_id, key_mode, difficulty] = key.split(':');
            return {
                song_id,
                key_mode: parseInt(key_mode),
                difficulty,
                high_score: r.score,
                max_combo: r.maxCombo,
                best_accuracy: r.accuracy,
                best_grade: r.grade,
                last_played_at: new Date(r.timestamp).toISOString(),
                play_count: r.playCount || 1
            };
        });

        return { 
            success: true, 
            stats: {
                max_streak: Math.max(...records.map(r => r.max_combo), 0),
                total_notes_hit: records.reduce((acc, r) => acc + (r.max_combo * 0.9), 0), 
                play_count: records.reduce((acc, r) => acc + r.play_count, 0),
                total_score: records.reduce((acc, r) => acc + r.high_score, 0),
                level: this.currentLevel,
                exp: this.totalXP
            }, 
            records 
        };
    }

    public getLocalRanking(): any[] {
        return Object.entries(this.highScores)
            .map(([songId, record]) => ({
                display_name: 'Local Player',
                score: record.score,
                accuracy: record.accuracy,
                max_combo: record.maxCombo,
                timestamp: new Date(record.timestamp).toISOString(),
                songId: songId
            }))
            .sort((a, b) => b.score - a.score);
    }

    // ===========================
    // GUEST-ONLY LOCAL STORAGE
    // ===========================

    /**
     * Save data to localStorage. ONLY used in guest mode.
     */
    private saveGuestData(): void {
        try {
            const payload = {
                highScores: this.highScores,
                favorites: Array.from(this.favorites)
            };
            localStorage.setItem(ScoreManager.GUEST_STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            console.warn("[ScoreManager] Failed to save guest data:", e);
        }
    }

    /**
     * Load data from localStorage. ONLY used in guest mode (or initial boot before login check).
     */
    public loadGuestData(): void {
        this.highScores = {};
        this.favorites = new Set();
        this.totalXP = 0;
        this.currentLevel = 1;
        this.health = this.maxHealth;

        // Only load from localStorage if NOT signed in
        if (AuthService.getInstance().isSignedIn()) {
            // Logged-in user: wait for syncWithServer() to populate data
            return;
        }

        try {
            const raw = localStorage.getItem(ScoreManager.GUEST_STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                this.highScores = data.highScores || {};
                this.favorites = new Set(data.favorites || []);
            }
        } catch (e) {
            console.warn("[ScoreManager] Failed to load guest data:", e);
        }
    }

    /**
     * Alias for loadGuestData for backward compatibility.
     */
    public load(): void {
        this.loadGuestData();
    }

    /**
     * Persist data — only writes to localStorage in guest mode.
     * Logged-in: do NOT write to localStorage. Server is the source of truth.
     */
    public save(): void {
        if (!AuthService.getInstance().isSignedIn()) {
            this.saveGuestData();
        }
    }

    public clearAccountData(): void {
        localStorage.removeItem(ScoreManager.GUEST_STORAGE_KEY);
        this.highScores = {};
        this.favorites = new Set();
        this.totalXP = 0;
        this.currentLevel = 1;
        this.totalCoins = 0;
        this.stats = null;
    }
}
