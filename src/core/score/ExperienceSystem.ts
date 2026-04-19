/**
 * ExperienceSystem - Handles XP calculation and Leveling logic
 * Formula: Level = floor(sqrt(TotalXP / 100)) + 1
 */
export class ExperienceSystem {
    private static BASE_XP_FACTOR = 0.01; // Adjust this to balance progression speed

    /**
     * Calculates XP gained from a single play session
     */
    public static calculateGainedXP(score: number, accuracy: number, difficulty: string): number {
        // Difficulty multipliers
        const difficultyMultipliers: Record<string, number> = {
            'EASY': 0.8,
            'NORMAL': 1.0,
            'HARD': 1.3,
            'EXPERT': 1.8
        };

        const mult = difficultyMultipliers[difficulty.toUpperCase()] || 1.0;
        const accBonus = accuracy / 100; // 0.0 ~ 1.0

        // XP = (Score * AccuracyFactor * DifficultyMultiplier) / constant
        const gained = (score * accBonus * mult) * this.BASE_XP_FACTOR;
        
        return Math.floor(gained);
    }

    /**
     * Converts total XP to a level
     */
    public static getLevelFromXP(totalXP: number): number {
        if (totalXP <= 0) return 1;
        // L = sqrt(XP / 100) + 1
        return Math.floor(Math.sqrt(totalXP / 100)) + 1;
    }

    /**
     * Gets the total XP required to reach a specific level
     */
    public static getXPThresholdForLevel(level: number): number {
        if (level <= 1) return 0;
        // XP = (L - 1)^2 * 100
        return Math.pow(level - 1, 2) * 100;
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
}
