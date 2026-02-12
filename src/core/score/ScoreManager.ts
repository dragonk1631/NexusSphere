export class ScoreManager {
    private static instance: ScoreManager;
    private currentCombo: number = 0;
    private maxCombo: number = 0;
    private score: number = 0;

    // Health System
    private health: number = 100;
    private maxHealth: number = 100;

    private constructor() {
        this.load();
    }

    public static getInstance(): ScoreManager {
        if (!ScoreManager.instance) {
            ScoreManager.instance = new ScoreManager();
        }
        return ScoreManager.instance;
    }

    public addHit(baseScore: number = 100): void {
        this.currentCombo++;
        if (this.currentCombo > this.maxCombo) {
            this.maxCombo = this.currentCombo;
        }
        this.score += baseScore * (1 + Math.min(this.currentCombo, 50) * 0.1);
        this.heal(2); // Heal slightly on hit
        this.save();
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

