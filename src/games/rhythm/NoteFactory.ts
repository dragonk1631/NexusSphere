import type { ParsedMidi, GameNote, GameTrack } from '../../core/audio/MidiParser';

export interface VisualNote extends GameNote {
    lane: number;
    isProcessed: boolean;
}

export class NoteFactory {
    /**
     * MIDI 데이터를 게임용 비주얼 노트 배열로 변환합니다.
     * @param midi 파싱된 MIDI 데이터
     * @param laneCount 레인 수 (기본 4레인)
     */
    /**
     * MIDI 데이터를 게임용 비주얼 노트 배열로 변환합니다.
     * @param midi 파싱된 MIDI 데이터
     * @param laneCount 레인 수 (기본 4레인)
     * @param targetTrack (옵션) 특정 트랙만 대상으로 할 경우
     */
    public static createNotes(midi: ParsedMidi, laneCount: number = 4, targetTrack: GameTrack | null = null): VisualNote[] {
        const visualNotes: VisualNote[] = [];

        let notesToProcess: import('../../core/audio/MidiParser').GameNote[] = [];

        if (targetTrack) {
            // 1. 선택된 단일 트랙 모드
            notesToProcess = targetTrack.notes;
        } else {
            // 2. 기존: 모든 트랙 병합 (메인 멜로디나 드럼이 아닌 경우 잡음이 될 수 있음)
            // 개선: 노트 수가 가장 많은 상위 2개 트랙만 병합하거나, 드럼 트랙을 우선시
            const sortedTracks = [...midi.tracks].sort((a, b) => b.noteCount - a.noteCount);
            // 상위 3개 트랙만 사용
            sortedTracks.slice(0, 3).forEach(track => {
                notesToProcess.push(...track.notes);
            });
        }

        notesToProcess.forEach(note => {
            // 간단한 레인 배분 로직: MIDI Pitch + Time 활용하여 난수성 부여
            const lane = (note.midi + Math.floor(note.time)) % laneCount;

            visualNotes.push({
                ...note,
                lane,
                isProcessed: false
            });
        });

        // 시간 순으로 정렬
        return visualNotes.sort((a, b) => a.time - b.time);
    }
}
