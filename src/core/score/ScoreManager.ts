import { Judgment } from '../../games/rhythm/types/GameTypes';
import { CryptoUtils } from '../system/CryptoUtils';
import { AuthService } from '../../services/auth/AuthService';
export interface ScoreRecord {
    score: number;
    maxCombo: number;
    accuracy: number;
    grade: string; // S+, S, A, B, C, D, F
    timestamp: number;
}

export class ScoreManager {
    private static instance: ScoreManager;
    private currentCombo: number = 0;
    private maxCombo: number = 0;
    private score: number = 0;
    private isTestMode: boolean = false;
    private isServerDown: boolean = false; // [NEW] Circuit breaker for 404s

    // Health System
    private health: number = 100;
    private maxHealth: number = 100;

    // Stats Tracking
    private perfectCount: number = 0;
    private greatCount: number = 0;
    private goodCount: number = 0;
    private missCount: number = 0;
    private totalChartNotes: number = 0;

    // Persistence
    private highScores: { [songId: string]: ScoreRecord } = {};

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

    // --- Persistence Methods ---

    public async saveHighScore(songId: string): Promise<boolean> {
        const newRecord: ScoreRecord = {
            score: Math.floor(this.score),
            maxCombo: this.maxCombo,
            accuracy: this.getAccuracy(),
            grade: this.getGrade(),
            timestamp: Date.now()
        };

        const existing = this.highScores[songId];
        let isNewRecord = false;

        // Save if no existing record OR new score is higher
        if (!existing || newRecord.score > existing.score) {
            this.highScores[songId] = newRecord;
            this.save();
            isNewRecord = true;
        }

        // --- Server Sync ---
        const auth = AuthService.getInstance();
        if (auth.isSignedIn()) {
            await this.uploadScoreToServer(songId, newRecord);
        }

        return isNewRecord;
    }

    private async uploadScoreToServer(songId: string, record: ScoreRecord): Promise<void> {
        if (this.isServerDown) return; // Skip if we already know server is 404

        try {
            const auth = AuthService.getInstance();
            const userId = auth.getUserId();
            const userName = auth.getUserName();
            
            const nonce = CryptoUtils.generateNonce();
            const secret = import.meta.env.VITE_SCORE_SECRET || 'temporary_secret_key';
            
            // HMAC 서명에 userName 포함 (순서 중요: userId:userName:songId:score:accuracy:nonce)
            const message = `${userId}:${userName}:${songId}:${record.score}:${record.accuracy.toFixed(2)}:${nonce}`;
            const signature = await CryptoUtils.signMessage(message, secret);

            const payload = { 
                userId, 
                userName, // 실제 이름 추가
                songId, 
                score: record.score, 
                accuracy: record.accuracy, 
                maxCombo: record.maxCombo, 
                nonce, 
                signature 
            };

            const response = await fetch('/api/scores/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 404) this.isServerDown = true; // Trip the circuit
                console.debug('[ScoreManager] 서버 점수 전송 실패 (오프라인/404):', response.status);
            } else {
                console.log('[ScoreManager] 서버 점수 전송 성공');
            }
        } catch (e) {
            this.isServerDown = true;
            console.debug('[ScoreManager] 서버 전송 중 오류 발생 (네트워크 차단됨)');
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

    public getHighScore(songId: string): ScoreRecord | null {
        return this.highScores[songId] || null;
    }

    private save(): void {
        try {
            localStorage.setItem('nexussphere_highscores_v1', JSON.stringify(this.highScores));
        } catch (e) {
            console.warn("Failed to save high scores:", e);
        }
    }

    private load(): void {
        try {
            const data = localStorage.getItem('nexussphere_highscores_v1');
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
