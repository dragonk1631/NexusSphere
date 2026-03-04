import { type VisualNote } from '../NoteFactory';
import {
    JUDGMENT_WINDOWS
} from '../constants/GameConstants';

/**
 * Event handler for judgment results.
 */
export interface IJudgmentEventHandler {
    onJudgment(lane: number, judgment: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS', timeDiff: number): void;
    onHoldStart(lane: number, note: VisualNote): void;
    onHoldEnd(lane: number): void;
}

/**
 * JudgmentSystem handles hit detection, timing windows, and miss tracking.
 * It is a pure logic component independent of rendering.
 */
export class JudgmentSystem {
    private handler: IJudgmentEventHandler;

    // -- State (Moved from RhythmGame) --
    private holdingLanes: (VisualNote | null)[] = [null, null, null, null, null, null];
    private lastMissCheckIndex: number = 0;
    private outputLatencyMs: number = 0;
    private lagSpikeInvincibility: number = 0;
    private lastJudgment: { text: string; color: string; time: number } | null = null;

    constructor(handler: IJudgmentEventHandler) {
        this.handler = handler;
    }

    public reset(): void {
        this.holdingLanes.fill(null);
        this.lastMissCheckIndex = 0;
        this.lagSpikeInvincibility = 0;
        this.lastJudgment = null;
    }

    public update(delta: number): void {
        if (this.lagSpikeInvincibility > 0) {
            this.lagSpikeInvincibility -= delta;
        }
    }

    public setLatency(ms: number): void {
        this.outputLatencyMs = ms;
    }

    public setLagInvincibility(ms: number): void {
        this.lagSpikeInvincibility = ms;
    }

    /**
     * Finds the closest note in a lane and evaluates the hit.
     */
    public checkHit(lane: number, currentTimeMs: number, notes: VisualNote[]): VisualNote | null {
        if (this.lagSpikeInvincibility > 0) return null;

        // Effective timing window for scanning (200ms either side)
        const scanWindow = 200;
        const searchStart = currentTimeMs - scanWindow;
        const searchEnd = currentTimeMs + scanWindow;

        let bestNote: VisualNote | null = null;
        let minDiff = Infinity;

        // Start search from last checked index for efficiency (assuming notes are sorted)
        for (let i = this.lastMissCheckIndex; i < notes.length; i++) {
            const note = notes[i];
            if (note.lane !== lane || note.isProcessed) continue;

            const noteTimeMs = note.time * 1000;
            if (noteTimeMs < searchStart) continue;
            if (noteTimeMs > searchEnd) break;

            const diff = Math.abs(currentTimeMs - noteTimeMs);
            if (diff < minDiff) {
                minDiff = diff;
                bestNote = note;
            }
        }

        if (bestNote) {
            const diff = currentTimeMs - (bestNote.time * 1000);
            const absDiff = Math.abs(diff);

            let judgment: 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS' | null = null;

            if (absDiff <= JUDGMENT_WINDOWS.PERFECT) judgment = 'PERFECT';
            else if (absDiff <= JUDGMENT_WINDOWS.GREAT) judgment = 'GREAT';
            else if (absDiff <= JUDGMENT_WINDOWS.GOOD) judgment = 'GOOD';
            else if (absDiff <= JUDGMENT_WINDOWS.HIT) judgment = 'MISS'; // Out of bounds but counts as an attempt

            if (judgment) {
                if (judgment === 'MISS' || !bestNote.isHold) {
                    bestNote.isProcessed = true;
                }
                if (judgment !== 'MISS' && bestNote.isHold) {
                    bestNote.isHolding = true; // 핵심 플래그 설정: 이제 시스템이 이 노트를 '누르고 있음'으로 인식합니다.
                    this.holdingLanes[lane] = bestNote;
                    this.handler.onHoldStart(lane, bestNote);
                }
                this.handler.onJudgment(lane, judgment, diff);
                return bestNote;
            }
        }

        return null;
    }

    /**
     * Checks for notes that were missed (passed the hit line without being hit).
     */
    public updateMissedNotes(currentTimeMs: number, notes: VisualNote[]): void {
        const missWindow = JUDGMENT_WINDOWS.HIT; // Same as GOOD/HIT boundary

        for (let i = this.lastMissCheckIndex; i < notes.length; i++) {
            const note = notes[i];
            const noteTimeMs = note.time * 1000;
            const noteEndMs = note.isHold ? noteTimeMs + note.durationMs : noteTimeMs;

            // Stop loop since notes are sorted by time
            if (noteTimeMs > currentTimeMs + 100) break;

            if (note.isProcessed) {
                // Advance the search start index
                if (i === this.lastMissCheckIndex) this.lastMissCheckIndex++;
                continue;
            }

            // [핵심 수정] 롱노트 자동 성공 제거 및 Late Release 감지
            // 사용자가 계속 누르고 있더라도 꼬리를 일정 시간(lateReleaseWindow) 이상 지나치면 실패 처리합니다.
            const lateReleaseWindow = 200;

            if (note.isHold && note.isHolding && currentTimeMs > noteEndMs + lateReleaseWindow) {
                // 너무 오래 누르고 있음 (Late Release 실패)
                this.processRelease(note.lane, currentTimeMs); // second arg success defaults to false
                if (i === this.lastMissCheckIndex) this.lastMissCheckIndex++;
                continue;
            }

            // 미스 처리: 판정 창(missWindow)을 벗어난 경우 (일반 노트 or 안 누른 롱노트)
            if (currentTimeMs > noteEndMs + missWindow && !note.isHolding) {
                note.isProcessed = true;
                this.handler.onJudgment(note.lane, 'MISS', 0);
                if (i === this.lastMissCheckIndex) this.lastMissCheckIndex++;
            }
        }
    }

    public processRelease(lane: number, currentTimeMs: number, forceSuccess: boolean = false): void {
        const heldNote = this.holdingLanes[lane];
        if (heldNote) {
            const tailTimeMs = (heldNote.time * 1000) + heldNote.durationMs;

            // 릴리즈 판정 로직: 꼬리 도달 전후로 일정한 Window 내에 떼어야 성공
            const earlyReleaseWindow = 250;
            const lateReleaseWindow = 200;

            const isWithinEarlyWindow = currentTimeMs >= tailTimeMs - earlyReleaseWindow;
            const isWithinLateWindow = currentTimeMs <= tailTimeMs + lateReleaseWindow;

            // 두 윈도우 안에 들어와야 PERFECT 처리
            const finalSuccess = forceSuccess || (isWithinEarlyWindow && isWithinLateWindow);

            heldNote.isProcessed = true;
            heldNote.isHolding = false;
            this.holdingLanes[lane] = null;
            this.handler.onHoldEnd(lane);

            if (finalSuccess) {
                this.handler.onJudgment(lane, 'PERFECT', 0);
            } else {
                // 너무 일찍 떼거나 너무 늦게 뗀 경우 MISS
                this.handler.onJudgment(lane, 'MISS', 0);
            }
        }
    }

    public getHoldingNote(lane: number): VisualNote | null {
        return this.holdingLanes[lane];
    }

    public isLaneHolding(lane: number): boolean {
        return this.holdingLanes[lane] !== null;
    }

    public setJudgment(text: string, color: string, time: number): void {
        this.lastJudgment = { text, color, time };
    }

    public getLastJudgment(): { text: string; color: string; time: number } | null {
        return this.lastJudgment;
    }

    public getLatency(): number {
        return this.outputLatencyMs;
    }

    public getLagInvincibility(): number {
        return this.lagSpikeInvincibility;
    }
}
