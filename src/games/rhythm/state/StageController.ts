
import { ASSET_PATHS } from '../../../core/asset/AssetRegistry';
import { NoteFactory } from '../NoteFactory';
import { GameState } from '../types/GameTypes';
import { StageManager } from './StageManager';
import { AudioLoader } from '../services/AudioLoader';
import { MenuManager } from './MenuManager';
import { ScoreManager } from '../../../core/score/ScoreManager';

/**
 * StageController handles the high-level transitions between menu and gameplay.
 * It coordinates assets loading, song setup, and initial game object creation.
 */
export class StageController {
    private stage: StageManager;
    private audioLoader: AudioLoader;
    private menuManager: MenuManager;
    private scoreManager: ScoreManager;
    private audioEngine: any;

    constructor(
        stage: StageManager,
        audioLoader: AudioLoader,
        menuManager: MenuManager,
        scoreManager: ScoreManager,
        audioEngine: any
    ) {
        this.stage = stage;
        this.audioLoader = audioLoader;
        this.menuManager = menuManager;
        this.scoreManager = scoreManager;
        this.audioEngine = audioEngine;
    }

    public async load(): Promise<void> {
        console.log("[StageController] Loading stage...");
        this.audioEngine.resetTimeState();
        await this.audioEngine.init(ASSET_PATHS.AUDIO.SOUNDFONTS.DEFAULT);

        const currentSong = this.menuManager.getCurrentSong();
        await this.audioLoader.load(currentSong.url, this.stage.isTestMode, this.stage.transitionData);

        this.stage.midiData = this.audioLoader.getMidiData();
        this.stage.beatmapData = this.audioLoader.getBeatmapData();
    }

    public create(): void {
        console.log("[StageController] Creating Stage...");
        const { midiData, beatmapData, transitionData, isTestMode } = this.stage;

        if (midiData) {
            let forcedChannels: number[] | null = null;
            let measureConfig: [number, number][] | null = null;

            if (transitionData?.settings?.measureConfig) {
                measureConfig = transitionData.settings.measureConfig;
            } else if (transitionData?.forcedChannels) {
                forcedChannels = transitionData.forcedChannels;
            } else if (beatmapData?.version === "1.2" && beatmapData?.measureConfig) {
                measureConfig = beatmapData.measureConfig;
            }

            let difficulty = transitionData?.settings?.difficulty;
            if (!isTestMode && !difficulty) {
                difficulty = this.menuManager.getCurrentDifficulty();
            }
            if (!difficulty) difficulty = 'NORMAL';

            this.stage.visualNotes = NoteFactory.createNotes(midiData, this.stage.keyMode, forcedChannels, difficulty, measureConfig);
            this.scoreManager.setTotalNotes(this.stage.visualNotes.length);

            if (isTestMode && transitionData?.settings) {
                this.setupAudioCompliance(transitionData);
                this.stage.currentState = GameState.MENU;
            }
        }
    }

    private setupAudioCompliance(transitionData: any): void {
        const soloChannels = transitionData.settings.soloChannels;
        const hasSolo = soloChannels && soloChannels.size > 0;

        if (hasSolo) {
            for (let ch = 0; ch < 16; ch++) {
                this.audioEngine.setChannelMute(ch, !soloChannels.has(ch));
            }
        } else if (transitionData.settings.mutedChannels) {
            transitionData.settings.mutedChannels.forEach((ch: number) => {
                this.audioEngine.setChannelMute(ch, true);
            });
        }
    }
}
