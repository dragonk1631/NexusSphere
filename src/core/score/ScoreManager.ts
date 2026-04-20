import { Judgment } from '../../games/rhythm/types/GameTypes';
import { AuthService } from '../../services/auth/AuthService';
import { ExperienceSystem } from './ExperienceSystem';

export interface ScoreRecord {
    score: number;
    maxCombo: number;
    accuracy: number;
    grade: string; // S+, S, A, B, C, D, F
    timestamp: number;
}

export class ScoreManager {
    private static instance: ScoreManager;
    private static STORAGE_KEY_V2 = 'nexussphere_highscores_v2';
    private static STORAGE_KEY_V1 = 'nexussphere_highscores_v1';

    private currentCombo: number = 0;
    private maxCombo: number = 0;
    private score: number = 0;
    private isTestMode: boolean = false;
    private isServerDown: boolean = false;

    // XP & Level State (Online only)
    private totalXP: number = 0;
    private currentLevel: number = 1;
    private gainedXP: number = 0; // Last session gain
    private gainedCoin: number = 0; // [NEW] Track Coin gained in last session

    // Health System
    private health: number = 100;
    private maxHealth: number = 100;

    // Stats Tracking
    private perfectCount: number = 0;
    private greatCount: number = 0;
    private goodCount: number = 0;
    private missCount: number = 0;
    private totalChartNotes: number = 0;

    // Persistence (v2: { [songId:mode:difficulty]: ScoreRecord })
    private highScores: { [recordKey: string]: ScoreRecord } = {};

    private constructor() {
        this.load();
    }

    public static getInstance(): ScoreManager {
        if (!ScoreManager.instance) {
            ScoreManager.instance = new ScoreManager();
        }
        return ScoreManager.instance;
    }

    public setTotalNotes(count: number): void {
        this.totalChartNotes = count;
    }

    public addHit(baseScore: number = 100, judgment: Judgment = Judgment.PERFECT): void {
        if (judgment === Judgment.MISS) {
            this.missCount++;
            this.resetCombo();
            if (!this.isTestMode) this.damage(5);
            return;
        }

        this.currentCombo++;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }

        // Detailed Counters
        if (judgment === Judgment.PERFECT) this.perfectCount++;
        else if (judgment === Judgment.GREAT) this.greatCount++;
        else if (judgment === Judgment.GOOD) this.goodCount++;

        // Combo Multiplier for Score only
        if (!this.isTestMode) {
            this.score += baseScore * (1 + Math.min(this.currentCombo, 50) * 0.1);
            this.heal(2); // Heal slightly on hit
        }
    }

    public addScore(points: number): void {
        if (this.isTestMode) return;
        this.score += points;
    }

    public increaseCombo(amount: number): void {
        this.currentCombo += amount;
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
        if (acc >= 98) return 'S+';
        if (acc >= 95) return 'S';
        if (acc >= 90) return 'A';
        if (acc >= 80) return 'B';
        if (acc >= 70) return 'C';
        if (acc >= 50) return 'D';
        return 'F';
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

    public damage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
    }

    public heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    public isDead(): boolean {
        return this.health <= 0;
    }

    public getTotalXP(): number { return this.totalXP; }
    public getCurrentLevel(): number { return this.currentLevel; }
    public getLastGainedXP(): number { return this.gainedXP; }
    public getLastGainedCoin(): number { return this.gainedCoin; }

    public getHealth(): number {
        return this.health;
    }

    public getMaxHealth(): number {
        return this.maxHealth;
    }

    public resetCombo(): void {
        this.currentCombo = 0;
    }

    public reset(): void {
        this.score = 0;
        this.currentCombo = 0;
        this.maxCombo = 0;
        this.health = this.maxHealth;
        this.perfectCount = 0;
        this.greatCount = 0;
        this.goodCount = 0;
        this.missCount = 0;
    }

    public setTestMode(enabled: boolean): void {
        this.isTestMode = enabled;
    }

    /**
     * [DEBUG] Force All Perfect & Full Combo status immediately
     */
    public forceFullCombo(): void {
        const total = this.totalChartNotes > 0 ? this.totalChartNotes : 500;
        this.totalChartNotes = total;
        this.perfectCount = total;
        this.greatCount = 0;
        this.goodCount = 0;
        this.missCount = 0;
        this.maxCombo = total;
        this.currentCombo = total;
        this.health = this.maxHealth;
        
        // Calculate a perfect score based on total notes
        // Standard formula: sum(base * (1 + min(combo, 50) * 0.1))
        let simulatedScore = 0;
        for (let i = 1; i <= total; i++) {
            simulatedScore += 100 * (1 + Math.min(i, 50) * 0.1);
        }
        this.score = Math.floor(simulatedScore);
    }

    public getCombo(): number {
        return this.currentCombo;
    }

    public getMaxCombo(): number {
        return this.maxCombo;
    }

    public getScore(): number {
        return this.score;
    }

    public isFullCombo(): boolean {
        return this.missCount === 0 && this.totalChartNotes > 0;
    }

    // --- XP & Leveling ---
    
    /**
     * [CLOUD-SYNC] Restore all records and progression from the server
     */
    public async syncWithServer(): Promise<void> {
        const auth = AuthService.getInstance();
        if (!auth.isSignedIn()) return;

        try {
            const token = await auth.getClerk()?.session?.getToken();
            if (!token) return;

            const response = await fetch('/api/user/sync', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // 1. Sync Profile Stats
                    const stats = data.stats;
                    this.totalXP = stats.exp || 0;
                    this.currentLevel = stats.level || 1;
                    
                    // 2. Sync High Scores
                    if (data.records) {
                        data.records.forEach((r: any) => {
                            const key = `${r.song_id}:${r.key_mode}:${r.difficulty}`;
                            this.highScores[key] = {
                                score: r.high_score,
                                maxCombo: r.max_combo,
                                accuracy: r.best_accuracy,
                                grade: r.best_grade,
                                timestamp: new Date(r.last_played_at).getTime()
                            };
                        });
                    }
                    
                    // 3. Save to Local Storage for offline persistence
                    this.save();
                    console.info('[ScoreManager] Cloud data synchronized successfully.');
                }
            }
        } catch (e) {
            console.error('[ScoreManager] Failed to sync with server:', e);
        }
    }

    public async saveHighScore(songId: string, keyMode: number, difficulty: string): Promise<{ isNewRecord: boolean, gainedXP: number, gainedCoin: number }> {
        const accuracy = this.getAccuracy();
        const grade = this.getGrade();
        const isFC = this.isFullCombo();
        const isAP = isFC && (this.greatCount + this.goodCount) === 0;

        const newRecord: ScoreRecord = {
            score: Math.floor(this.score),
            maxCombo: this.maxCombo,
            accuracy: accuracy,
            grade: grade,
            timestamp: Date.now()
        };

        const recordKey = `${songId}:${keyMode}:${difficulty}`;
        const existing = this.highScores[recordKey];
        let isNewRecord = false;

        if (!existing || newRecord.score > existing.score) {
            this.highScores[recordKey] = newRecord;
            this.save();
            isNewRecord = true;
        }

        // --- XP & Economy Sync ---
        const auth = AuthService.getInstance();
        let sessionGainedXP = 0;
        let sessionGainedCoin = 0;

        // Dynamic imports to avoid issues
        const { ExperienceSystem } = await import('./ExperienceSystem');
        const { EconomyManager } = await import('./EconomyManager');
        
        if (auth.isSignedIn()) {
            sessionGainedXP = ExperienceSystem.calculateGainedXP(this.maxCombo, grade, difficulty, isFC, isAP);
            sessionGainedCoin = ExperienceSystem.calculateGainedCoin(this.maxCombo, grade);

            this.updateExperience(sessionGainedXP);
            this.gainedCoin = sessionGainedCoin;
            EconomyManager.getInstance().addCoins(sessionGainedCoin);

            // Background upload (Enhanced with all professional stats)
            this.uploadScoreToServer(songId, keyMode, difficulty, newRecord, sessionGainedXP, sessionGainedCoin, isFC, isAP);
        } else {
            this.gainedXP = 0;
            this.gainedCoin = 0;
        }

        return { isNewRecord, gainedXP: sessionGainedXP, gainedCoin: sessionGainedCoin };
    }

    public updateExperience(gained: number): { levelUp: boolean } {
        const oldLevel = this.currentLevel;
        this.totalXP += gained;
        this.gainedXP = gained;
        
        // Use ExperienceSystem for precise level calculation
        this.currentLevel = ExperienceSystem.getLevelFromXP(this.totalXP);
        
        return { levelUp: this.currentLevel > oldLevel };
    }

    private async uploadScoreToServer(
        songId: string, keyMode: number, difficulty: string, 
        record: ScoreRecord, gainedXP: number, gainedCoin: number,
        isFC: boolean, isAP: boolean
    ): Promise<void> {
        if (this.isServerDown) return;

        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();
            
            // Enrich payload with all data for Migration 0003
            const payload = { 
                songId, 
                keyMode,
                difficulty,
                score: record.score, 
                accuracy: record.accuracy, 
                maxCombo: record.maxCombo,
                gainedXP,
                gainedCoin,
                grade: record.grade,
                isFC,
                isAP,
                perfect: this.perfectCount,
                great: this.greatCount,
                good: this.goodCount,
                miss: this.missCount,
                nickname: auth.getUserName(),
                avatarUrl: auth.getClerk()?.user?.imageUrl
            };

            const response = await fetch('/api/scores/submit', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 404) this.isServerDown = true;
                console.debug('[ScoreManager] 서버 동기화 실패:', response.status);
            }
        } catch (e) {
            console.debug('[ScoreManager] 서버 전송 중 오류:', e);
        }
    }

    /**
     * [OFFLINE] Local ranking data retrieval for RankingUI fallback
     */
    public getLocalRanking(): any[] {
        // Convert map to sorted array
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

    public getHighScore(songId: string, keyMode: number, difficulty: string): ScoreRecord | null {
        return this.highScores[`${songId}:${keyMode}:${difficulty}`] || null;
    }

    private save(): void {
        try {
            localStorage.setItem(ScoreManager.STORAGE_KEY_V2, JSON.stringify(this.highScores));
        } catch (e) {
            console.warn("Failed to save high scores:", e);
        }
    }

    private load(): void {
        try {
            // Clean up old v1 data
            localStorage.removeItem(ScoreManager.STORAGE_KEY_V1);

            const data = localStorage.getItem(ScoreManager.STORAGE_KEY_V2);
            if (data) {
                this.highScores = JSON.parse(data);
            }
        } catch (e) {
            console.warn("Failed to load high scores:", e);
            this.highScores = {};
        }
        this.health = this.maxHealth;
    }
}
