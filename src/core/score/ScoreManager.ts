export class ScoreManager {
    private static instance: ScoreManager;
    private currentCombo: number = 0;
    private maxCombo: number = 0;
    private score: number = 0;

    // Health System
    private health: number = 100;
    private maxHealth: number = 100;

    // Stats Tracking
    private perfectCount: number = 0;
    private greatCount: number = 0;
    private goodCount: number = 0;
    private missCount: number = 0;
    private totalChartNotes: number = 0;

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

    public addHit(baseScore: number = 100, judgment: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS' = 'PERFECT'): void {
        if (judgment === 'MISS') {
            this.missCount++;
            this.resetCombo();
            this.damage(5);
            return;
        }

        this.currentCombo++;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }

        // Detailed Counters
        if (judgment === 'PERFECT') this.perfectCount++;
        else if (judgment === 'GREAT') this.greatCount++;
        else if (judgment === 'GOOD') this.goodCount++;

        // Combo Multiplier for Score only
        this.score += baseScore * (1 + Math.min(this.currentCombo, 50) * 0.1);
        this.heal(2); // Heal slightly on hit
        this.save();
    }

    public addScore(points: number): void {
        this.score += points;
    }

    public increaseCombo(amount: number): void {
        this.currentCombo += amount;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }
        this.save();
    }

    public getAccuracy(): number {
        if (this.totalChartNotes === 0) return 0;

        // ACCURACY CALCULATION (Non-Combo Based)
        // Perfect = 1.0, Great = 0.75, Good = 0.5, Miss = 0
        const points = (this.perfectCount * 1.0) + (this.greatCount * 0.75) + (this.goodCount * 0.5);
        return (points / this.totalChartNotes) * 100;
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
        this.save();
    }

    public heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.save();
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
        this.save();
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
        this.save();
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

    private save(): void {
        localStorage.setItem('nexussphere_combo', this.currentCombo.toString());
        localStorage.setItem('nexussphere_score', this.score.toString());
        localStorage.setItem('nexussphere_max_combo', this.maxCombo.toString());
    }

    private load(): void {
        const combo = localStorage.getItem('nexussphere_combo');
        const score = localStorage.getItem('nexussphere_score');
        const maxCombo = localStorage.getItem('nexussphere_max_combo');

        if (combo) this.currentCombo = parseInt(combo);
        if (score) this.score = parseFloat(score);
        if (maxCombo) this.maxCombo = parseInt(maxCombo);
        this.health = this.maxHealth; // Always reset health on load/init for now
    }
}

