import { type VisualNote } from '../NoteFactory';
import { ScoreManager } from '../../../core/score/ScoreManager';
import { ParticleSystem } from '../systems/ParticleSystem';
import { JudgmentSystem } from '../systems/JudgmentSystem';
import { LANE_COLORS } from '../constants/GameConstants';
import { CoreAudioEngine } from '../../../core/audio/CoreAudioEngine';
import type { TransitionData } from '../../../core/GameTransition';

/**
 * Configuration for the Lag Gating logic to prevent visual teleportation.
 */
const LAG_GATE_CONFIG = {
    MAX_DRIFT_MS: 100,
    MAX_STEP_MS: 33,
    MIN_STEP_MS: 16
} as const;

/**
 * GameplayManager handles the core logic during the PLAYING state.
 * It manages timers, note traversal, and synchronization.
 */
export class GameplayManager {
    // -- Internal State --
    private _visualNotes: VisualNote[] = [];
    private _holdingLanes: (VisualNote | null)[] = [null, null, null, null, null, null];
    private _isAudioStarted = false;
    private _preGameTimer = 0;
    private _targetStartTime = 0;
    private _lastNoteIndex = 0;
    private _effectiveStartTime = 0;
    private _comboAnim = 0;
    private _judgmentAnim = 0;
    private _endGameTimer = 0;
    private _lastCombo = 0;
    private _muteEnforceCounter = 0;
    private _fpsCounter = 0;
    private _fpsTimer = 0;
    private _lastFps = 0;
    private _needsForceSync = false;
    private _resumeCountdown = 0;

    // -- Dependencies --
    private audioEngine: CoreAudioEngine;
    private scoreManager: ScoreManager;
    private particleSystem: ParticleSystem;
    private judgmentSystem: JudgmentSystem;

    constructor(
        audioEngine: CoreAudioEngine,
        scoreManager: ScoreManager,
        particleSystem: ParticleSystem,
        judgmentSystem: JudgmentSystem
    ) {
        this.audioEngine = audioEngine;
        this.scoreManager = scoreManager;
        this.particleSystem = particleSystem;
        this.judgmentSystem = judgmentSystem;
    }

    // -- Getters --
    public get visualNotes(): VisualNote[] { return this._visualNotes; }
    public get holdingLanes(): (VisualNote | null)[] { return this._holdingLanes; }
    public get isAudioStarted(): boolean { return this._isAudioStarted; }
    public get preGameTimer(): number { return this._preGameTimer; }
    public get comboAnim(): number { return this._comboAnim; }
    public set comboAnim(val: number) { this._comboAnim = val; }
    public get judgmentAnim(): number { return this._judgmentAnim; }
    public get muteEnforceCounter(): number { return this._muteEnforceCounter; }
    public set muteEnforceCounter(val: number) { this._muteEnforceCounter = val; }
    public get lastNoteIndex(): number { return this._lastNoteIndex; }
    public get resumeCountdown(): number { return this._resumeCountdown; }
    public set resumeCountdown(val: number) { this._resumeCountdown = val; }

    public isHoldingAnyLane(): boolean {
        return this._holdingLanes.some(lane => lane !== null);
    }

    public setHoldingLane(lane: number, note: VisualNote | null): void {
        this._holdingLanes[lane] = note;
    }

    public clearHoldingLane(lane: number): void {
        this._holdingLanes[lane] = null;
    }

    public reset(): void {
        this._visualNotes = [];
        this._holdingLanes.fill(null);
        this._isAudioStarted = false;
        this._preGameTimer = 0;
        this._targetStartTime = 0;
        this._lastNoteIndex = 0;
        this._effectiveStartTime = 0;
        this._comboAnim = 0;
        this._judgmentAnim = 0;
        this._endGameTimer = 0;
        this._lastCombo = 0;
        this._muteEnforceCounter = 0;
        this._needsForceSync = true; // CRITICAL: Reset sync state
        this._resumeCountdown = 0; // CRITICAL: Do not count down on start
        this.judgmentSystem.reset();
    }

    public start(notes: VisualNote[], scrollSpeed: number): void {
        this._visualNotes = notes;
        this._holdingLanes.fill(null);

        this.audioEngine.stop();

        // Pinpoint Fix from SYNC_LOGIC.md: 
        // Seek to 0 to trigger SpessaSynth's silence skipping, then capture REAL start time.
        this.audioEngine.seek(0);
        this._effectiveStartTime = this.audioEngine.currentTime;
        this._targetStartTime = 0;

        const approachTime = 2000 / scrollSpeed;
        this._preGameTimer = approachTime + 500;

        this._isAudioStarted = false;
        this._lastNoteIndex = 0;
        this._endGameTimer = 0;
        this._lastCombo = 0;
        this._comboAnim = 0;
        this._judgmentAnim = 0;
        this._needsForceSync = true;
        this._resumeCountdown = 0;
    }
    
    public forceNextSync(): void {
        this._needsForceSync = true;
    }

    public triggerJudgmentAnim(): void {
        this._judgmentAnim = 1.0;
    }

    public update(delta: number, currentTime: number, _horizonY: number, hitLineY: number, laneBottomWidth: number, getPerspectiveX: (lane: number, y: number) => number, getPerspectiveWidth: (y: number) => number): void {
        // --- Diagnostic: FPS & Delta Monitoring ---
        this._fpsCounter++;
        this._fpsTimer += delta;
        if (this._fpsTimer >= 1000) {
            this._lastFps = this._fpsCounter;
            if (this._lastFps < 50) {
                console.warn(`[GamePerf:FPS] Low frame rate detected: ${this._lastFps} FPS`);
            }
            this._fpsCounter = 0;
            this._fpsTimer = 0;
        }

        if (delta > 33.4) { // Roughly < 30 FPS for a single frame
            console.warn(`[GamePerf:SPIKE] Heavy frame detected: ${delta.toFixed(1)}ms gap`);
        }
        // ------------------------------------------

        this._holdingLanes.forEach((note, lane) => {
            if (note) {
                note.isHolding = true;
                note.accumulatedHoldTime += delta;

                // Tick 1: Combo & Score (166ms interval)
                const tickInterval = 166;
                if (note.accumulatedHoldTime >= tickInterval) {
                    this.scoreManager.increaseCombo(1);
                    this.scoreManager.addScore(10);
                    note.accumulatedHoldTime -= tickInterval;
                    this._comboAnim = 0.5;
                    this._judgmentAnim = 0.6; // Stronger sync for hold ticks
                    // CRITICAL: Use performance.now() to sync with the HUD's aging logic
                    this.judgmentSystem.refreshLastJudgmentTime(performance.now()); 
                }

                // Tick 2: Visual Effects (Particles & Theme-specific hit effects)
                if (performance.now() % 60 < 16) {
                    const laneX = getPerspectiveX(lane, hitLineY) + getPerspectiveWidth(hitLineY) / 2;
                    const centerY = hitLineY + (laneBottomWidth * 0.2);
                    const color = LANE_COLORS[lane] ? LANE_COLORS[lane][1] : '#ffffff';
                    this.particleSystem.triggerShatter(laneX, centerY, color, true);
                }

                const effectInterval = 150;
                if ((note.accumulatedHoldTime % effectInterval) < delta) {
                    this.judgmentSystem['handler'].onHoldEffect(lane);
                }
            }
        });

        if (this._comboAnim > 0) {
            this._comboAnim -= delta * 0.005;
            if (this._comboAnim < 0) this._comboAnim = 0;
        }

        if (this._judgmentAnim > 0) {
            this._judgmentAnim -= delta * 0.005; // Unified decay rate with comboAnim
            if (this._judgmentAnim < 0) this._judgmentAnim = 0;
        }

        const currentCombo = this.scoreManager.getCombo();
        if (currentCombo > this._lastCombo) {
            this._comboAnim = 1.0;
            // Optionally boost pulse on regular combo increase if not already high
            if (this._judgmentAnim < 0.5) this._judgmentAnim = 0.5;
        }
        this._lastCombo = currentCombo;

        this.judgmentSystem.updateMissedNotes(currentTime, this._visualNotes);
        this._lastNoteIndex = this.judgmentSystem.getMissCheckIndex();

        if (this._preGameTimer > 0) {
            this._preGameTimer -= delta;
        }
    }

    public shouldStartAudio(): boolean {
        return this._preGameTimer <= 0 && !this._isAudioStarted;
    }

    /**
     * Handles audio synchronization and time tracking.
     */
    public syncTime(judgmentLatency: number, lastRenderTime: number, _delta: number = 16): number {
        if (this._preGameTimer > 0) {
            // Pinpoint Fix formula: (Start Point - Latency) - Remaining Countdown
            // This ensures a mathematically identical hand-off when music starts.
            return (this._effectiveStartTime * 1000) - this._preGameTimer - judgmentLatency;
        }

        if (!this._isAudioStarted) {
            this.startAudio();
            return (this._effectiveStartTime * 1000) - judgmentLatency;
        }

        const rawTime = this.audioEngine.getPreciseTime() * 1000;
        const currentTime = rawTime - judgmentLatency;

        if (this._needsForceSync) {
            this._needsForceSync = false;
            return currentTime; // BYPASS LAG GATING: Hard jump to audio clock
        }

        return this.applyLagGating(currentTime, lastRenderTime);
    }

    private startAudio(): void {
        this.audioEngine.seek(this._targetStartTime);
        this.audioEngine.play();
        const actualStartTime = this.audioEngine.currentTime;
        this.audioEngine.startPreciseTime(actualStartTime);
        this._isAudioStarted = true;
    }

    private applyLagGating(currentTime: number, lastRenderTime: number): number {
        const drift = currentTime - lastRenderTime;

        // EMERGENCY: Hard Sync for massive drift (e.g. > 1s)
        // This avoids the "teleporting/speeding up" effect when hardware clock jumps or arrives late.
        if (Math.abs(drift) > 1000) {
            console.log(`[GameplayManager] Massive drift (${drift.toFixed(0)}ms). Performing HARD SYNC.`);
            return currentTime;
        }

        if (drift > LAG_GATE_CONFIG.MAX_DRIFT_MS) {
            return lastRenderTime + LAG_GATE_CONFIG.MAX_STEP_MS;
        }

        if (currentTime < lastRenderTime) {
            return lastRenderTime;
        }

        return currentTime;
    }

    public enforceMuteCompliance(transitionData: TransitionData | null): void {
        if (!transitionData?.settings) return;

        const { soloChannels, mutedChannels } = transitionData.settings;
        const hasSolo = soloChannels && soloChannels.size > 0;

        for (let ch = 0; ch < 16; ch++) {
            let isAudible = false;
            if (hasSolo) {
                isAudible = soloChannels!.has(ch);
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
        // Robustness: If songDuration is not provided, we can't determine completion
        if (songDurationMs <= 0) return false;

        // Condition 1: Direct time threshold (Reliable on PC)
        const timeCleared = currentTime >= songDurationMs - 100;
        
        // Condition 2: Fallback for Mobile (Buffer drift or low precision)
        // If we are within the final 300ms and the sequencer is no longer active, triggger completion.
        const audioStalledAtEnd = currentTime >= songDurationMs - 300 && !this.audioEngine.isBGMPlaying();

        if (timeCleared || audioStalledAtEnd) {
            this._endGameTimer += delta;
        }
        
        // 2000ms delay to allow final notes to finish their animation
        return this._endGameTimer > 2000;
    }
}
