/**
 * ExperienceSystem - Handles XP calculation, NC (Nexus Credits) earnings, and Leveling logic.
 * Formula (XP): [(BasePart + ComboPart) * DifficultyWeight * RankWeight] + AchievementBonus
 * Formula (NC): [(BasePart + ComboPart) * RankWeight]
 */
export class ExperienceSystem {
    private static BASE_CLEAR_XP = 20;
    private static BASE_CLEAR_COIN = 10;
    private static COMBO_XP_FACTOR = 0.1;
    private static COMBO_COIN_FACTOR = 0.05;

    /**
     * Calculates XP gained from a single play session
     */
    public static calculateGainedXP(maxCombo: number, grade: string, difficulty: string, isFC: boolean, isAP: boolean): number {
        const diffWeight = this.getDifficultyWeight(difficulty);
        const rankWeight = this.getRankWeight(grade);

        const basePart = this.BASE_CLEAR_XP + (maxCombo * this.COMBO_XP_FACTOR);
        let gained = (basePart * diffWeight * rankWeight);

        // Achievement Bonuses
        if (isAP) gained += 150;
        else if (isFC) gained += 50;

        return Math.floor(gained);
    }

    /**
     * Calculates Coin earned from a play session
     */
    public static calculateGainedCoin(maxCombo: number, grade: string): number {
        const rankWeight = this.getRankWeight(grade);
        const basePart = this.BASE_CLEAR_COIN + (maxCombo * this.COMBO_COIN_FACTOR);
        
        return Math.floor(basePart * rankWeight);
    }

    private static getDifficultyWeight(difficulty: string): number {
        const diff = difficulty.toUpperCase();
        if (diff === 'EASY') return 0.95;
        if (diff === 'NORMAL') return 1.0;
        if (diff === 'HARD') return 1.05;
        if (diff === 'EXPERT' || diff === 'EXTREME') return 1.1;
        return 1.0;
    }

    private static getRankWeight(grade: string): number {
        const g = grade.toUpperCase();
        if (g === 'S+') return 1.3;
        if (g === 'S') return 1.2;
        if (g === 'A') return 1.1;
        if (g === 'B') return 1.0;
        return 0.8; // C or below
    }

    /**
     * Converts total XP to a level
     * Formula: XP Threshold = 100 * (Level^1.5 + Level^2)
     * Using an iterative approach for precision since it's not a simple sqrt anymore.
     */
    public static getLevelFromXP(totalXP: number): number {
        if (totalXP <= 0) return 1;
        
        let level = 1;
        while (this.getXPThresholdForLevel(level + 1) <= totalXP) {
            level++;
            if (level >= 999) break; // Safety cap
        }
        return level;
    }

    /**
     * Gets the total XP required to reach a specific level
     * Formula: XP = 100 * ((L-1)^1.5 + (L-1)^2)
     */
    public static getXPThresholdForLevel(level: number): number {
        if (level <= 1) return 0;
        const L = level - 1;
        return Math.floor(100 * (Math.pow(L, 1.5) + Math.pow(L, 2)));
    }

    /**
     * Returns progress (0-1) within the current level
     */
    public static getLevelProgress(totalXP: number): number {
        const currentLevel = this.getLevelFromXP(totalXP);
        const currentThreshold = this.getXPThresholdForLevel(currentLevel);
        const nextThreshold = this.getXPThresholdForLevel(currentLevel + 1);
        
        const range = nextThreshold - currentThreshold;
        if (range <= 0) return 0;
        
        return (totalXP - currentThreshold) / range;
    }

    /**
     * Returns how much XP is needed for the next level
     */
    public static getXPToNextLevel(totalXP: number): number {
        const currentLevel = this.getLevelFromXP(totalXP);
        const nextThreshold = this.getXPThresholdForLevel(currentLevel + 1);
        return Math.max(0, nextThreshold - totalXP);
    }

    /**
     * Returns a player title based on level
     */
    public static getPlayerTitle(level: number): string {
        if (level >= 100) return "안티그라비티 킹";
        if (level >= 50) return "공허의 마스터";
        if (level >= 25) return "넥서스의 조율자";
        if (level >= 10) return "리듬의 탐색자";
        return "시작하는 여행자";
    }
}
