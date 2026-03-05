import { type VisualNote } from '../NoteFactory';
import { ScoreManager } from '../../../core/score/ScoreManager';
import { ParticleSystem } from '../systems/ParticleSystem';
import { JudgmentSystem } from '../systems/JudgmentSystem';
import { LANE_COLORS } from '../constants/GameConstants';

/**
 * GameplayManager handles the core logic during the PLAYING state.
 * It manages timers, note traversal, and synchronization.
 */
export class GameplayManager {
    // -- State --
    public visualNotes: VisualNote[] = [];
    public holdingLanes: (VisualNote | null)[] = [null, null, null, null, null, null];
    public isAudioStarted = false;
    public preGameTimer = 0;
    public targetStartTime = 0;
    public effectiveStartTime = 0;
    public lastNoteIndex = 0;
    public comboAnim = 0;
    public endGameTimer = 0;
    public lastCombo = 0;
    public muteEnforceCounter = 0;

    private audioEngine: any;
    private scoreManager: ScoreManager;
    private particleSystem: ParticleSystem;
    private judgmentSystem: JudgmentSystem;

    constructor(
        audioEngine: any,
        scoreManager: ScoreManager,
        particleSystem: ParticleSystem,
        judgmentSystem: JudgmentSystem
    ) {
        this.audioEngine = audioEngine;
        this.scoreManager = scoreManager;
        this.particleSystem = particleSystem;
        this.judgmentSystem = judgmentSystem;
    }

    public reset(): void {
        this.visualNotes = [];
        this.holdingLanes.fill(null);
        this.isAudioStarted = false;
        this.preGameTimer = 0;
        this.targetStartTime = 0;
        this.effectiveStartTime = 0;
        this.lastNoteIndex = 0;
        this.comboAnim = 0;
        this.endGameTimer = 0;
        this.lastCombo = 0;
        this.judgmentSystem.reset();
    }

    public start(notes: VisualNote[], scrollSpeed: number): void {
        this.visualNotes = notes;
        this.holdingLanes.fill(null);

        this.audioEngine.stop();
        this.audioEngine.seek(0);
        this.targetStartTime = 0;
        this.effectiveStartTime = this.audioEngine.currentTime;

        const approachTime = 2000 / scrollSpeed;
        this.preGameTimer = approachTime + 500;

        this.isAudioStarted = false;
        this.lastNoteIndex = 0;
        this.endGameTimer = 0;
        this.lastCombo = 0;
        this.comboAnim = 0;
    }

    public update(delta: number, currentTime: number, _horizonY: number, hitLineY: number, laneBottomWidth: number, getPerspectiveX: (lane: number, y: number) => number, getPerspectiveWidth: (y: number) => number): void {
        // 1. Long Note Hold Logic
        this.holdingLanes.forEach((note, lane) => {
            if (note) {
                // 제거됨: 이제 JudgmentSystem.ts의 updateMissedNotes가 
                // 릴리즈 윈도우를 벗어난 노트를 공정하게 처리(MISS)합니다.

                note.isHolding = true;
                note.accumulatedHoldTime += delta;
                const tickInterval = 166;

                if (note.accumulatedHoldTime >= tickInterval) {
                    this.scoreManager.increaseCombo(1);
                    this.scoreManager.addScore(10);
                    note.accumulatedHoldTime -= tickInterval;
                    this.comboAnim = 0.5;
                }

                // Hold Particles
                if (performance.now() % 60 < 16) { // Approx once per 4 frames
                    const laneX = getPerspectiveX(lane, hitLineY) + getPerspectiveWidth(hitLineY) / 2;
                    const centerY = hitLineY + (laneBottomWidth * 0.2);
                    const color = LANE_COLORS[lane] ? LANE_COLORS[lane][1] : '#ffffff';
                    this.particleSystem.triggerShatter(laneX, centerY, color, true);
                }
            }
        });

        // 2. Combo Animation Sync
        if (this.comboAnim > 0) {
            this.comboAnim -= delta * 0.005;
            if (this.comboAnim < 0) this.comboAnim = 0;
        }

        const currentCombo = this.scoreManager.getCombo();
        if (currentCombo > this.lastCombo) {
            this.comboAnim = 1.0;
        }
        this.lastCombo = currentCombo;

        // 3. Judgment System Update
        this.judgmentSystem.updateMissedNotes(currentTime, this.visualNotes);

        // -- Stage 4: Sync Logic --
        if (this.preGameTimer > 0) {
            this.preGameTimer -= delta;
        }
    }

    /**
     * Checks if we just finished preGame timer and should start audio
     */
    public shouldStartAudio(): boolean {
        return this.preGameTimer <= 0 && !this.isAudioStarted;
    }

    /**
     * Handles audio synchronization and time tracking.
     */
    public syncTime(judgmentLatency: number, lastRenderTime: number): number {
        let currentTime = 0;

        if (this.shouldStartAudio()) {
            this.audioEngine.seek(this.targetStartTime);
            this.audioEngine.play();
            const actualStartTime = this.audioEngine.currentTime;
            this.audioEngine.startPreciseTime(actualStartTime);
            this.isAudioStarted = true;
            currentTime = -judgmentLatency;
        } else if (this.preGameTimer > 0) {
            currentTime = -this.preGameTimer - judgmentLatency;
        } else if (!this.isAudioStarted) {
            this.audioEngine.seek(0);
            this.audioEngine.play();
            const actualStartTime = this.audioEngine.currentTime;
            this.audioEngine.startPreciseTime(actualStartTime);
            this.isAudioStarted = true;
            currentTime = -judgmentLatency;
        } else {
            currentTime = (this.audioEngine.getPreciseTime() * 1000) - judgmentLatency;

            // LAG GATING: If audio clock jumps too much (>100ms), 
            // nudge it back to prevent visual teleportation.
            const drift = currentTime - lastRenderTime;
            if (drift > 100) {
                currentTime = lastRenderTime + 33; // Limited "jump"
            } else if (currentTime < lastRenderTime) {
                currentTime = lastRenderTime; // Monotonicity
            }
        }
        return currentTime;
    }

    public enforceMuteCompliance(transitionData: any): void {
        if (!transitionData?.settings) return;

        const soloChannels = transitionData.settings.soloChannels;
        const mutedChannels = transitionData.settings.mutedChannels;
        const hasSolo = soloChannels && soloChannels.size > 0;

        for (let ch = 0; ch < 16; ch++) {
            let isAudible = false;
            if (hasSolo) {
                isAudible = soloChannels.has(ch);
            } else {
                isAudible = !mutedChannels?.has(ch);
            }

            if (!isAudible) {
                this.audioEngine.overrideChannelVolume(ch, 0);
            }
        }
    }

    public isGameOver(): boolean {
        return this.scoreManager.isDead();
    }

    public isSongCompleted(currentTime: number, songDurationMs: number, delta: number): boolean {
        if (currentTime >= songDurationMs - 100 && songDurationMs > 2000) {
            this.endGameTimer += delta;
        }
        return this.endGameTimer > 2000;
    }
}
