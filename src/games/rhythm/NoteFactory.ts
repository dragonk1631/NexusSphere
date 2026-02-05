import type { ParsedMidi, GameNote } from '../../core/audio/MidiParser';

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
    public static createNotes(midi: ParsedMidi, laneCount: number = 4): VisualNote[] {
        const visualNotes: VisualNote[] = [];

        // 모든 트랙의 노트를 취합 (드럼 트랙 우선 순위 등 로직 확장 가능)
        midi.tracks.forEach(track => {
            track.notes.forEach(note => {
                visualNotes.push({
                    ...note,
                    // 음높이(MIDI number)를 레인 수로 나누어 골고루 분배
                    lane: note.midi % laneCount,
                    isProcessed: false
                });
            });
        });

        // 시간 순으로 정렬
        return visualNotes.sort((a, b) => a.time - b.time);
    }
}
