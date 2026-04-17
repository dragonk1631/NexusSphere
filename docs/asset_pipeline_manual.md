# NexusSphere 자산 처리 파이브라인 가이드

이 문서는 NexusSphere 프로젝트에서 신규 곡을 추가하고, 미디 비트맵을 생성하며, 서버에 배포하는 자동화된 파이프라인의 사용법을 설명합니다.

---

## 🚀 파이프라인 전체 요약

1.  **MP3 배치**: `public/assets/audio/mp3/` 폴더에 신규 음원 파일을 넣습니다.
2.  **미디 생성**: `convert_mp3_to_midi.mjs` 스크립트로 AI 비트 분석 및 미디 생성을 수행합니다.
3.  **배포 및 동기화**: `deploy_assets.mjs` 스크립트로 메타데이터 갱신, 음량 분석, 번들링 및 R2 업로드를 수행합니다.

---

## 🛠 상세 단계별 가이드

### 1단계: 음원 준비 (MP3 Placement)
- **경로**: `public/assets/audio/mp3/`
- **파일명 규칙**: 곡 제목을 가급적 영문/숫자 혹은 깔끔한 한글로 작성하세요. (특수문자 지양)
- **참고**: 테마 곡의 경우 `public/assets/audio/ui/themes/` 경로에 넣어도 시스템이 자동으로 인식합니다.

### 2단계: 자동 미디 생성 (MIDI Generation)
이 단계에서는 `Demucs`와 `Librosa`를 사용하여 음원을 분석하고 게임용 미디 파일을 만듭니다.

```bash
node scripts/convert_mp3_to_midi.mjs
```
- **기능**:
    - `Demucs`: 드럼, 보컬, 베이스 트랙 분리
    - `Librosa`: BPM 및 비트 그리드 분석
    - `Tone.js`: 최종 미디 파일(`.mid`) 생성
- **산출물**: `public/assets/audio/generated_midi/[곡명].mid`

### 3단계: 통합 배포 프로세스 (Deployment & Sync)
이 스크립트 하나로 모든 동기화 작업이 완료됩니다.

```bash
node scripts/deploy_assets.mjs
```

이 스크립트는 내부적으로 다음 작업들을 **순차적으로** 수행합니다:
1.  **`sync_song_list.mjs`**: 생성된 미디 파일을 스캔하여 `official_songs.json` 레지스트리를 갱신합니다.
2.  **`analyze_audio_levels.mjs`**: 모든 MP3의 피크 음량을 FFmpeg로 분석하여 `-1.5dB` 기준의 노멀라이즈 값을 계산해 반영합니다. (미리보기 및 게임 내 음량 밸런스 유지)
3.  **`generate_assets_manifest.js`**: 클라이언트가 인식할 전체 자산 목록(매니페스트)을 생성합니다.
4.  **`generate_bundle.mjs`**: 모든 자산을 압축하여 `assets_bundle.zip`을 만듭니다.
5.  **R2 Upload**: Cloudflare R2 스토리지로 변경된 파일들을 업로드합니다.

---

## 💡 주요 참고 사항 및 문제 해결

### 필수 환경 (Dependencies)
- **Node.js**: 자산 관리 스크립트 실행용
- **Python (py)**: `librosa`, `demucs` 라이브러리 설치 필수
- **FFmpeg**: `ffmpeg-static`을 통해 음량 분석 수행

### 음량 노멀라이즈 (Normalization)
- 모든 곡은 `normalizationGain` 필드를 통해 재생 시 실시간으로 볼륨이 보정됩니다.
- 수동으로 볼륨을 조정하고 싶다면 `official_songs.json`에서 해당 곡의 `normalizationGain` 값을 직접 수정하면 됩니다.

### 미리보기 시작 지점 (Preview Start)
- 프리뷰가 노래 시작부터 나오는 것이 어색하다면, `official_songs.json`의 해당 곡 엔트리에 `"previewStart": 45` (45초 지점)와 같이 추가하여 하이라이트부터 재생되게 할 수 있습니다.

---

> [!TIP]
> **한 줄 실행**: 모든 과정을 한 번에 끝내려면 다음 커맨드를 순차 실행하세요.
> `node scripts/convert_mp3_to_midi.mjs && node scripts/deploy_assets.mjs`
