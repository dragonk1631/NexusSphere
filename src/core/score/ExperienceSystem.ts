import { DJClassSystem } from '../progression/DJClassSystem';

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
     * New Balance: 40 * (L-1)^2 + 40 * (L-1)
     */
    public static getLevelFromXP(totalXP: number): number {
        if (totalXP <= 0) return 1;
        
        let level = 1;
        while (this.getXPThresholdForLevel(level + 1) <= totalXP) {
            level++;
            if (level >= 999) break; 
        }
        return level;
    }

    /**
     * Gets the total XP required to reach a specific level
     * Formula: XP = 40 * ((L-1)^2 + (L-1))
     * L=2: 40*(1+1) = 80
     * L=3: 40*(4+2) = 240
     * L=4: 40*(9+3) = 480
     */
    public static getXPThresholdForLevel(level: number): number {
        if (level <= 1) return 0;
        const L = level - 1;
        return Math.floor(40 * (L * L + L));
    }

    /**
     * Returns a detailed breakdown of gained XP for the result screen.
     */
    public static calculateXPBreakdown(maxCombo: number, grade: string, difficulty: string, isFC: boolean, isAP: boolean) {
        const diffWeight = this.getDifficultyWeight(difficulty);
        const rankWeight = this.getRankWeight(grade);
        
        const baseClearingXP = this.BASE_CLEAR_XP;
        const comboBonus = Math.floor(maxCombo * this.COMBO_XP_FACTOR);
        const subTotal = (baseClearingXP + comboBonus) * diffWeight;
        const totalWithRank = Math.floor(subTotal * rankWeight);
        
        let achievementBonus = 0;
        if (isAP) achievementBonus = 150;
        else if (isFC) achievementBonus = 50;

        return {
            base: baseClearingXP,
            comboBonus: comboBonus,
            difficultyMultiplier: diffWeight,
            rankMultiplier: rankWeight,
            achievementBonus: achievementBonus,
            total: totalWithRank + achievementBonus
        };
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
     * Returns a player title based on level (DJ Class)
     */
    public static getPlayerTitle(level: number): string {
        return DJClassSystem.getClassInfo(level).name;
    }
}
