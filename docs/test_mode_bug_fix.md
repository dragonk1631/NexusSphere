# 테스트 모드 버그 수정 기록

**날짜**: 2026-02-19  
**증상**: 에디터에서 테스트 버튼을 누르면 게임이 시작되자마자 HP가 0이 되어 즉시 게임 오버

---

## 증상

에디터에서 테스트 플레이를 시작하면:

- 노트가 전혀 없는 것처럼 모두 MISS 처리됨
- 게임 시작 직후 HP가 0이 되어 즉시 종료
- 일반 모드(메뉴에서 시작)에서는 정상 동작

---

## 디버깅 방법

Chrome F12 → Console 탭에서 로그를 수집하여 분석.  
핵심 단서가 된 로그:

```text
# 문제가 있던 로그
Playback started. Time: 8.708s       ← 0초가 아닌 8.7초에서 재생 시작!
PreciseTime started. Offset: 8.708s  ← 게임 시계가 8.7초 앵커
State: 1, Time: 9.11s                ← 게임 시작 직후 이미 9초

# 수정 후 정상 로그
Playback started. Time: 0.000s       ✓
PreciseTime started. Offset: 0.000s  ✓
State: 1, Time: 0.37s → 1.37s → 2.39s  ✓
```

---

## 근본 원인 (3가지)

### 원인 1: SpessaSynth 자동재생 (핵심)

`loadNewSongList()`를 호출하면 SpessaSynth 시퀀서가 **내부적으로 자동 재생을 시작**한다.

```text
loadMidi() → loadNewSongList() → 시퀀서 자동 재생 시작
preGameTimer 2초 카운트다운 동안 시퀀서가 혼자 진행
→ preGameTimer 완료 시점: sequencer.currentTime = 8.708s
→ startPreciseTime()이 8.708s를 앵커로 사용
→ 게임 시계가 8.7초에서 시작
→ 0초부터 시작하는 모든 노트가 이미 8초 지난 것으로 판정 → 전부 MISS
```

**수정**: `startPreciseTime(startOffset?: number)` 파라미터 추가.  
RhythmGame에서 `startPreciseTime(0)`으로 항상 0을 명시적으로 전달.

```typescript
// CoreAudioEngine.ts
public startPreciseTime(startOffset?: number): void {
    const seqTime = startOffset !== undefined ? startOffset : (this.sequencer?.currentTime || 0);
    // ...
}

// RhythmGame.ts (update 루프)
this.audioEngine.seek(0);
this.audioEngine.play();
this.audioEngine.startPreciseTime(0);  // 항상 0 앵커
```

---

### 원인 2: EditorGame canvas 이벤트 리스너 누수

EditorGame과 RhythmGame은 **같은 canvas 엘리먼트**를 재사용한다.  
EditorGame의 `touchstart` 핸들러가 **익명 함수**로 canvas에 등록되어 있어서 `destroy()`에서 제거 불가능했다.

```text
RhythmGame 실행 중 화면 터치
→ EditorGame의 canvas touchstart 핸들러 실행 (아직 살아있음!)
→ handleMouseDown() → seekAtMouse() → syncAudioStates()
→ 시퀀서 상태를 건드림
```

로그에서 RhythmGame 실행 중에도 `EditorGame.ts:628 [Audio Sync]`가 계속 출력되는 것으로 확인.

**수정**: 모든 이벤트 리스너를 바인딩된 메서드로 변경하고 `destroy()`에서 완전히 제거.

```typescript
// EditorGame.ts
private _boundCanvasTouchStart: (e: TouchEvent) => void;
// ...
constructor() {
    this._boundCanvasTouchStart = (e) => { e.preventDefault(); this.handleMouseDown(e); };
}

public destroy(): void {
    // canvas 리스너도 반드시 제거
    this.canvas.removeEventListener('touchstart', this._boundCanvasTouchStart);
    this.canvas.removeEventListener('mousedown', this._boundMouseDown);
    // window 리스너도 제거
    window.removeEventListener('mousemove', this._boundMouseMove);
    // ...
}
```

---

### 원인 3: CoreAudioEngine 싱글톤 시간 상태 오염

`CoreAudioEngine`은 싱글톤이다. `init()`은 `isReady=true`이면 즉시 반환하므로,  
EditorGame이 사용하던 `lastReportedTime` 등이 리셋되지 않고 RhythmGame으로 넘어갔다.

**수정**: `resetTimeState()` 메서드 추가. `RhythmGame.load()`에서 `init()` 전에 호출.

```typescript
// CoreAudioEngine.ts
public resetTimeState(): void {
    this.isPrecisePlaying = false;
    this.preciseStartTime = 0;
    this.precisePausedTime = 0;
    this.lastReportedTime = 0;
}

// RhythmGame.ts
this.audioEngine.resetTimeState();  // 이전 게임 시간 상태 초기화
await this.audioEngine.init(...);
```

---

## 수정된 파일

| 파일 | 수정 내용 |
| ------ | ----------- |
| `src/core/audio/CoreAudioEngine.ts` | `resetTimeState()` 추가, `startPreciseTime(startOffset?)` 파라미터 추가 |
| `src/games/rhythm/RhythmGame.ts` | `resetTimeState()` 호출, `startPreciseTime(0)` 명시적 호출, `seek(0)` 추가 |
| `src/games/editor/EditorGame.ts` | 모든 이벤트 리스너 바인딩된 메서드로 변경, `destroy()`에서 canvas+window 리스너 완전 제거 |

---

## 교훈

1. **싱글톤 상태 오염**: 게임 전환 시 싱글톤의 상태를 명시적으로 리셋해야 한다.
2. **이벤트 리스너 누수**: 익명 함수로 등록한 리스너는 제거 불가능하다. 항상 바인딩된 메서드를 사용할 것.
3. **라이브러리 내부 동작**: `loadNewSongList()`의 자동재생처럼 외부 라이브러리의 숨겨진 동작을 항상 의심해야 한다.
4. **로그 기반 디버깅**: 추측이 아닌 실제 로그 값을 보고 디버깅해야 한다. `Time: 8.708s` 한 줄이 3일간의 미스터리를 해결했다.
