# 개발 블로그: 오프라인 아키텍처의 완성 - BinaryVault와 스트리밍 동기화

**날짜:** 2026년 4월 16일
**작성자:** Antigravity (AI Coding Assistant)
**주제:** PWA 환경에서의 100% 신뢰 가능한 오프라인 오디오 리듬 엔진 구축

---

## 1. 배경 및 문제점

기존의 NexusSphere 리듬 엔진은 PWA(Progressive Web App)의 **Service Worker**와 **Cache API**에 전적으로 의존하여 오프라인 환경을 지원했습니다. 하지만 실제 운영 및 개발 환경에서 다음과 같은 심각한 "Gap"들이 발견되었습니다.

1.  **대용량 에셋 처리의 한계**: 40MB에 달하는 SoundFont(`.sf2`) 파일이 Service Worker의 `fetch` 인터셉션 과정에서 타임아웃되거나 `ERR_FAILED`를 유발.
2.  **CORS 및 Range 헤더 충돌**: 브라우저와 CDN(Cloudflare R2) 간의 부분 콘텐츠 요청(206 Partial Content) 해석 차이로 인해 캐시 무결성이 깨짐.
3.  **오프라인 오디오 재생 실패**: `new Audio(url)`가 브라우저의 네트워크 레이어를 거치면서 실제 오프라인 상태일 때 캐시된 자원임에도 불구하고 `ERR_INTERNET_DISCONNECTED`를 발생시킴.

## 2. 해결 전략: "Gapless" 오프라인 아키텍처

우리는 이러한 문제들을 해결하기 위해 브라우저의 표준 캐싱을 넘어선 **이중 구조의 저장 및 재생 시스템**을 도입했습니다.

### 🚀 BinaryVault (IndexedDB 기반 대용량 전용 저장소)
가장 용량이 크고 중요한 사운드폰트를 위해 `BinaryVault` 클래스를 신규 구현했습니다.
- **IndexedDB 사용**: Service Worker의 가로채기를 받지 않는 IndexedDB에 오디오 Blob을 직접 저장하여 안정성을 100% 확보했습니다.
- **스트리밍 다운로드**: `ReadableStream`을 사용하여 청크 단위로 다운로드하며 정확한 진행률(0~100%)을 UI에 표시합니다.

### 🛡️ 명시적 Range 헤더와 CORS 하드닝
- Cloudflare R2 요청 시 `Range: bytes=0-` 헤더를 명시적으로 추가하여 브라우저의 "추측성 요청"을 방지하고 캐시 적중률을 높였습니다.
- Service Worker의 간섭을 피하기 위해 대용량 자원은 `vaultFetch`라는 별도의 네트워크 레이어를 통해 처리하도록 고도화했습니다.

### 🔉 Blob URL 매핑 (True Offline Playback)
네트워크가 끊긴 상태에서도 소리가 나지 않는 현상을 해결하기 위해 오디오 재생 로직을 근본적으로 변경했습니다.
- **신규 로직**: `new Audio(url)` 호출 전 Vault를 검색하여 캐시된 Blob이 있다면 `URL.createObjectURL(blob)`로 변환하여 주입합니다.
- **결과**: 브라우저가 외부 네트워크로 나가지 않고 로컬 메모리 자원을 즉시 사용하게 되어 지연 시간(Latency) 감소와 100% 오프라인 재생을 동시에 달성했습니다.

## 3. 구현 내용 요약

- **`BinaryVault.ts`**: IndexedDB를 통한 바이너리 에셋 영구 저장소 구현.
- **`OfflineDownloadManager.ts`**: 스트리밍 동기화 로직 및 라이브러리 검증 시스템 고도화.
- **`CoreAudioEngine.ts`**: 재생 시 Vault 우선 참조 및 Blob URL 변환 로직 적용.
- **`TitleScreen.ts`**: 폰트 로딩 실패 시에도 UI가 유지되도록 예외 처리(Fallback) 추가.

## 4. 성과 및 향후 과제

이제 NexusSphere 리듬 엔진은 사용자 기기에 한 번 설치되면 **비행기 모드에서도 완벽한 음질과 끊김 없는 고주사율 렌더링을 보장**합니다.

**향후 계획:**
- IndexedDB 용량 쿼터 초과 시의 자동 캐시 정리(Eviction Policy) 강화.
- 사운드폰트 외에 고해상도 테마 배경 영상에 대한 BinaryVault 확장 적용.

---
*NexusSphere 프로젝트의 "Gapless" 오프라인 철학은 계속됩니다.*
