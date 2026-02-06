import { GameConfig } from '../config/GameConfig';

export class SkinManager {
    private static instance: SkinManager;

    private constructor() {
        GameConfig.load();
    }

    public static getInstance(): SkinManager {
        if (!SkinManager.instance) {
            SkinManager.instance = new SkinManager();
        }
        return SkinManager.instance;
    }

    public getBackground(): string {
        return GameConfig.skin.backgroundUrl || 'default';
    }

    public setBackground(url: string): void {
        GameConfig.skin.backgroundUrl = url;
        GameConfig.save();
    }

    // Add more skin methods as needed
}
