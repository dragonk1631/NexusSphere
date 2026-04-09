# 2026-04-08 개발 일지: MP3-to-MIDI Beat Engine v9.0 구현

## 오늘의 핵심 목표

리듬 게임에서 MP3 음원을 재생할 때 **채보(노트)가 전혀 나오지 않는 문제**를 최종�### 1-1. [긴급] 스테일 JSON 비트맵이 MIDI 데이터를 덮어쓰는 문제

- **현상**: 게임에서 곡을 선택하면 항상 `Collected 0 notes` — 노트가 하나도 안 나옴
- **원인**: `AudioLoader.ts`가 `assets/data/beatmaps/` 폴더의 JSON 파일을 우선 로드
  - 이 폴더에는 수개월 전에 생성된 **빈 껍데기 JSON 파일** 수십 개가 남아있었음
  - 게임 엔진이 새로 생성된 MIDI가 아닌 이 JSON을 읽어 노트 0개 반환
- **해결**: `public/assets/data/beatmaps/*.json` 전부 삭제

```powershell
Remove-Item -Path "public\assets\data\beatmaps\*.json" -Force
```

### 1-2. [데이터 오염] Tone.js 벨로시티 규격 불일치

- **현상**: MIDI 파일은 존재하지만 인게임 파서가 비정상 데이터로 읽음
- **원인**: `@tonejs/midi`의 `addNote()`는 velocity를 `0.0 ~ 1.0` 범위로 받음
  - 기존 컨버터는 `40 ~ 127` (MIDI 정수값)을 그대로 전달 → 오버플로우
- **해결**:

```js
// 이전 (잘못됨)
velocity: Math.min(127, Math.floor(n.energy * 2500) + 50)
// 수정 후
velocity: (Math.min(127, Math.floor(n.energy * 2500) + 50)) / 127
```

### 1-3. [로직 버그] MelodyAnalyzer.ts 드럼 채널 누락

- **현상**: 인게임 `[Ranked Channels] Melodies: , Drums:` — 드럼 채널이 분석 결과에 없음
- **원인**: 드럼 성분을 발견하면 분석 배열(`analyzedChannels`)에서 즉시 `return`하여
  드럼 랭킹 단계에서 드럼 데이터가 없는 상태가 됨
- **해결**: `return` 대신 `isDrum = true` 태그 후 배열에 유지

```diff
- if (stats.isDrum || ...) { return; }
- analyzedChannels.push(stats);
+ if (!stats.isDrum && ...) {
+     analyzedChannels.push(stats);
+ } else {
+     stats.isDrum = true;
+     analyzedChannels.push(stats);
+ }
```

---

## 2. 컨버터 엔진 진화 과정

### v6.1 — HPSS 5포인트 근사화 (실패)

- **방식**: FFT 스펙트로그램 → 5포인트 median 근사 HPSS → 에너지 피크 선택
- **문제**: 5포인트 근사치가 너무 부정확해 harmonic/percussive 분리가 엉터리
- **결과**: 곡당 2,000~4,600개 노트 (스팸), 리듬감 없음

### v7.0 — BPM 감지 + 비트 그리드 퀀타이즈 (개선)

- **방식**: Autocorrelation BPM 감지 → 8분음표 그리드 생성 → 각 셀에서 최대 에너지 선택 → 전역 상위 40% 선택
- **문제**: 전역 분위수(Global Percentile) 필터 → 조용한 구간의 드럼 비트가 통째로 삭제됨
- **결과**: 일부 구간에만 노트 있고 나머지 구간은 빈 상태 → 불일치감

### v7.1 — 로컬 적응형 임계값 (일부 개선)

- **방식**: v7.0과 동일하되, 전역 비교가 아닌 ±16셀 지역 중앙값의 1.1~1.6배로 선택
- **문제**: ratio 여전히 부정확했고, 곡에 따라 노트 수 50~900개로 들쭉날쭉
- **결과**: 큰 개선 없음

### v8.0 — 스펙트럼 플럭스 온셋 감지 (근본 접근 변경)

- **핵심 개선**: HPSS 완전 제거, librosa 표준 방식으로 직접 스펙트럴 플럭스 계산

```text
# 기존 (잘못됨): 합산된 스칼라 에너지의 1차 차분
flux[n] = max(0, sumEnergy[n] - sumEnergy[n-1])

# 올바른 방식 (librosa 표준): 각 주파수 bin별 양의 변화량 합산
flux[n] = Σk max(0, spec[n][k] - spec[n-1][k])
```

- **저주파 전용 sub-band flux**: 킥드럼/스네어 주파수 대역(< 5kHz)만 사용한 드럼 감지 채널 추가
- **문제**: `peakPick` 내부의 `delta * std` 임계값이 사실상 효과 없음 (flux의 std가 거의 0)
- **결과**: `delta`를 아무리 높여도 노트 수가 500~700개에서 안 줄어들었음

### v9.0 — **Python librosa 백엔드** (최종, 현재 적용)

- **핵심 변경**: 순수 Node.js DSP를 완전히 포기하고 **Python librosa를 서브프로세스로 호출**
- **구조**:

```text
Node.js convert_mp3_to_midi.mjs
  └─ spawn('py', ['scripts/analyze_beats.py', mp3Path])
       ├─ librosa.load() → PCM
       ├─ librosa.effects.hpss(margin=4.0) → y_harm + y_perc
       ├─ librosa.beat.beat_track(y_perc) → BPM + beat_frames
       ├─ librosa.onset.onset_detect(y_perc) → drum onsets
       ├─ librosa.onset.onset_detect(y_harm) → melody onsets
       └─ JSON 출력
  └─ JSON 파싱 → @tonejs/midi로 MIDI 생성 → .mid 파일 저장
```

---

## 3. 최종 결과 (v9.0 librosa 기반)

| 곡 | BPM | 드럼 노트 | 멜로디 노트 | 알고리즘 |
| :--- | :--- | :--- | :--- | :--- |
| KiminoEgao1 | 95.7 | 527 | 498 | librosa HPSS + onset_detect |
| KiminoEgao2 | 92.3 | 634 | 621 | librosa HPSS + onset_detect |
| Your Smiling Face | 92.3 | 558 | 571 | librosa HPSS + onset_detect |
| Your Smiling Face2 | 103.4 | 625 | 576 | librosa HPSS + onset_detect |
| そば에있는것처럼 | 89.1 | 606 | 503 | librosa HPSS + onset_detect |
| 想이는돌고 | 143.6 | 763 | 736 | librosa HPSS + onset_detect |
| 너의 의미 | 143.6 | 372 | 369 | librosa HPSS + onset_detect |
| 너의 의미2 | 107.7 | 389 | 409 | librosa HPSS + onset_detect |

**처리 시간**: 곡당 평균 약 20~30초 (첫 번째 곡은 Numba JIT 컴파일로 60~90초)

---

## 4. 관련 파일 변경 내역

| 파일 | 변경 내용 |
| :--- | :--- |
| `scripts/convert_mp3_to_midi.mjs` | v9.0으로 전면 재작성 — librosa spawn 오케스트레이터 |
| `scripts/analyze_beats.py` | **신규** — librosa HPSS + beat_track + onset_detect Python 분석기 |
| `src/core/audio/MelodyAnalyzer.ts` | 드럼 채널 분석 풀 누락 버그 수정 |
| `public/assets/data/beatmaps/*.json` | **전체 삭제** — 스테일 JSON 비트맵 제거 |
| `public/assets/audio/generated_midi/*.mid` | 8곡 모두 v9.0으로 재생성 |

---

## 5. 설치된 Python 패키지

오늘 처음으로 Python librosa 의존성이 추가됨. 다른 개발 환경에서 작업 시 아래 명령 필요:

```bash
py -m pip install librosa soundfile numpy
```

설치된 버전:

- `librosa 0.11.0`
- `numpy 2.2.6`
- `soundfile 0.13.1`
- `numba 0.65.0` (librosa 의존성, JIT 컴파일러)

---

## 6. 남은 과제 (TODO)

### 🔴 최우선 (인게임 검증 필요)

- [ ] 게임에서 실제 플레이하여 노트가 드럼/보컬과 **정확히 일치하는지** 청각 검증
- [ ] `MelodyAnalyzer.ts` 수정 후 `[Ranked Channels] Melodies: X, Drums: Y` 로그 정상 출력 확인
- [ ] 노트 밀도가 게임플레이하기에 **적절한지** 확인 (너무 많으면 delta 값 조정)

### 🟡 librosa 파라미터 튜닝

- [ ] `onset_detect`의 `delta`, `wait`, `pre_avg`, `post_avg` 값 최적화
  - 현재: `delta=0.08, wait=10` (드럼), `delta=0.10, wait=10` (멜로디)
  - 노트가 여전히 많으면 `delta` 상향 (예: `0.12 → 0.15`)
  - 노트가 너무 적으면 `delta` 하향 (예: `0.05 → 0.07`)
- [ ] HPSS `margin` 파라미터 조정 — `margin=4.0` → `margin=6.0` 시 더 깔끔한 분리

### 🟢 기능 개선

- [ ] `analyze_beats.py`에 BPM을 MIDI 헤더에 정확히 기록하는 로직 개선
  - 현재: `midi.header.setTempo(Math.round(bpm))` but setTempo는 `μs/beat` 단위 필요
- [ ] 감지된 BPM이 의심스러울 때 `--bpm 120` 처럼 수동 오버라이드 옵션 추가
- [ ] `convert_mp3_to_midi.mjs`에 단일 파일 처리 옵션 추가 (`--file "곡명.mp3"`)

### 🔵 장기 과제

- [ ] librosa Python 환경이 없는 CI/CD 환경 대응 — Docker 컨테이너 또는 requirements.txt 문서화
- [ ] 새 MP3 파일 추가 시 자동으로 librosa 분석 + official_songs.json 업데이트 파이프라인 구성
- [ ] `AudioLoader.ts`의 MIDI 파일 로딩 우선순위 코드 주석/문서화 (재발 방지)

---

## 7. 기술 메모: 왜 순수 JS DSP는 작동하지 않았나?

순수 Node.js 환경에서의 오디오 DSP는 다음 이유로 librosa 수준의 결과를 낼 수 없다:

| 항목 | Node.js (순수 JS) | Python librosa |
| :--- | :--- | :--- |
| HPSS median 필터 | 5포인트 근사 (부정확) | 완전한 17포인트 numpy 행렬 median |
| 온셋 감지 | 수동 임계값 (불안정) | 논문 검증된 adaptive δ |
| BPM 추적 | Autocorrelation (단순) | DP + Rayleigh prior (가중치 자동 조정) |
| 수치 정밀도 | Float32 (단정밀도) | Float64 (배정밀도) |
| 성능 | 느림 (JS 싱글스레드) | 빠름 (numpy + BLAS 멀티스레드) |

**결론**: MP3-to-MIDI 변환처럼 정밀한 신호 처리가 필요한 작업은
학계 검증 라이브러리(librosa)를 서브프로세스로 호출하는 **하이브리드 아키텍처**가 올바른 선택이다.
