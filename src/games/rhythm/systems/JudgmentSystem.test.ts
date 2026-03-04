import { JudgmentSystem, type IJudgmentEventHandler } from './JudgmentSystem';
import type { VisualNote } from '../NoteFactory';

// Declare test globals to avoid lint errors without needing to install Jest/Vitest types
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (val: any) => any;
declare const beforeEach: (fn: () => void) => void;

// Mocking function utility for test independence
const createMockHandler = (): IJudgmentEventHandler => ({
    onJudgment: () => { },
    onHoldStart: () => { },
    onHoldEnd: () => { }
});

describe('JudgmentSystem 단위 테스트', () => {
    let mockHandler: IJudgmentEventHandler;
    let system: JudgmentSystem;

    beforeEach(() => {
        mockHandler = createMockHandler();
        system = new JudgmentSystem(mockHandler);
    });

    it('PERFECT 판정: 입력이 노트와 70ms 이내 차이일 때', () => {
        let recordedJudgment: string | null = null;
        mockHandler.onJudgment = (_lane, judgment, _diff) => {
            recordedJudgment = judgment;
        };

        const notes: VisualNote[] = [
            // time is in seconds. 1050ms = 1.05s
            { id: '1', time: 1.05, lane: 0, isHold: false, durationMs: 0, isProcessed: false, isHolding: false } as VisualNote
        ];

        // checkHit(lane, currentTimeMs, notes)
        // 1000ms - 1050ms = 50ms diff (<= 70ms PERFECT 윈도우)
        const hitNote = system.checkHit(0, 1000, notes);

        expect(hitNote).not.toBeNull();
        expect(recordedJudgment).toBe('PERFECT');
        expect(hitNote?.isProcessed).toBe(true);
    });

    it('GREAT 판정: 70ms 초과 ~ 120ms 이하', () => {
        let recordedJudgment: string | null = null;
        mockHandler.onJudgment = (_lane, judgment) => { recordedJudgment = judgment; };

        const notes: VisualNote[] = [
            { id: '1', time: 1.10, lane: 1, isHold: false, durationMs: 0, isProcessed: false, isHolding: false } as VisualNote
        ];

        // 1000ms input, 1.10s (1100ms) note time. Diff = 100ms.
        system.checkHit(1, 1000, notes);
        expect(recordedJudgment).toBe('GREAT');
    });

    it('MISS 판정 (지나친 노트): updateMissedNotes에 의해 일정 시간이 넘어가면 MISS 처리', () => {
        let missCount = 0;
        mockHandler.onJudgment = (_lane, judgment) => {
            if (judgment === 'MISS') missCount++;
        };

        const notes: VisualNote[] = [
            { id: '1', time: 1.0, lane: 2, isHold: false, durationMs: 0, isProcessed: false, isHolding: false } as VisualNote,
            { id: '2', time: 1.1, lane: 2, isHold: false, durationMs: 0, isProcessed: false, isHolding: false } as VisualNote
        ];

        // 현재 시간이 1200ms이면, 1.0s (1000ms) 노트는 200ms 경과. JUDGMENT_WINDOWS.HIT(170)보다 큼 -> MISS
        // 1.1s (1100ms) 노트는 100ms 경과 -> 아직 MISS 한계 안 지남
        system.updateMissedNotes(1200, notes);

        expect(missCount).toBe(1);
        expect(notes[0].isProcessed).toBe(true);
        expect(notes[1].isProcessed).toBe(false);
    });

    it('Lag Spike 무적 시간 적용 테스트', () => {
        let recordedJudgment: string | null = null;
        mockHandler.onJudgment = (_lane, judgment) => { recordedJudgment = judgment; };

        const notes: VisualNote[] = [
            { id: '1', time: 1.0, lane: 0, isHold: false, durationMs: 0, isProcessed: false, isHolding: false } as VisualNote
        ];

        // 렉 방지 무적시간 설정
        system.setLagInvincibility(500);

        // 입력해도 무시되어야 함
        const hitNote = system.checkHit(0, 1000, notes);

        expect(hitNote).toBeNull();
        expect(recordedJudgment).toBeNull();
    });
});
