/**
 * GameConfig - Global Configuration & Persistence
 */

export interface SkinConfig {
    backgroundUrl: string;
    noteSpriteUrl: string;
    laneDividerColor: string;
    hitLineColor: string;
}

export interface AudioConfig {
    masterVolume: number;
    sfxVolume: number;
    offset: number; // ms
}

export class GameConfig {
    private static STORAGE_KEY = 'nexussphere_config_v1';

    public static skin: SkinConfig = {
        backgroundUrl: '', // Empty means default color
        noteSpriteUrl: '', // Empty means default rect
        laneDividerColor: '#333',
        hitLineColor: '#00ffcc'
    };

    public static audio: AudioConfig = {
        masterVolume: 100,
        sfxVolume: 100,
        offset: 0
    };

    public static load(): void {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.skin) Object.assign(this.skin, parsed.skin);
                if (parsed.audio) Object.assign(this.audio, parsed.audio);
            } catch (e) {
                console.warn("Failed to load config", e);
            }
        }
    }

    public static save(): void {
        const data = {
            skin: this.skin,
            audio: this.audio
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }
}
