export class ScoreManager {
    private static instance: ScoreManager;
    private currentCombo: number = 0;
    private maxCombo: number = 0;
    private score: number = 0;

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
        this.save();
    }

    public resetCombo(): void {
        this.currentCombo = 0;
        this.save();
    }

    public getCombo(): number {
        return this.currentCombo;
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
    }
}
