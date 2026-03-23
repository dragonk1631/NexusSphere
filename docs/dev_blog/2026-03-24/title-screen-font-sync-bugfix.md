# 타이틀 스크린 폰트 동기화 버그 해결 기록
**날짜**: 2026-03-24  
**담당**: AI 코드 어시스턴트  
**상태**: ✅ 해결 완료

---

## 증상

- **일반 새로고침(F5)**: 정상 표시
- **강제 새로고침(Ctrl+F5, PC)**: 첫 화면에 다른 폰트(시스템 폰트)가 잠깐 표시된 후 올바른 폰트로 바뀜
- **모바일**: 항상 정상 표시

---

## 원인 분석 과정 (삽질의 기록)

### ❌ 1차 시도: `document.fonts.load()` 단순 대기
```typescript
document.fonts.load(font).then(() => show());
```
**실패 이유**: `load()` promise가 resolve되어도 `OffscreenCanvas`는 해당 폰트를 사용할 수 없는 경우가 있음.

### ❌ 2차 시도: setTimeout 지연
```typescript
setTimeout(() => show(), 500);
```
**실패 이유**: 단순 시간 지연은 근본 해결책이 아님. 환경마다 로딩 시간이 달라서 신뢰할 수 없음.

### ❌ 3차 시도: 폰트 너비 측정 폴링 (Stabilization Buffer)
```typescript
const interval = setInterval(() => {
    if (targetWidth !== fallbackWidth) clearInterval(interval);
}, 50);
```
**실패 이유**: 조건이 영원히 충족되지 않아 화면이 아예 표시되지 않는 치명적 버그 발생.

### ❌ 4차 시도: OffscreenCanvas → DOM canvas 교체
```typescript
const tempCanvas = document.createElement('canvas'); // OffscreenCanvas 대신
```
**부분 해결**: 폰트 컨텍스트 공유 문제를 해결했으나, 아래의 Race Condition은 그대로 남아 있었음.

---

## 진짜 원인: **Font Cache Race Condition** (레이스 컨디션)

```
[시간 흐름]
t=0ms  : TitleScreen 생성 → opacity: 0 (숨김), fonts.load() 호출 (비동기)
t=1ms  : 게임 루프 시작 → render() → preRenderLogo() 호출
t=1ms  : ⚠️ 폰트 아직 로드 안됨 → 시스템 폰트로 logoCache 생성 (오염!)
t=50ms : fonts.load() 완료 → preRenderLogo() 호출
t=50ms : ⚠️ "if (this.logoCache) return;" → 이미 오염된 캐시가 있어서 그냥 통과!
t=50ms : opacity: 1 → 오염된 캐시로 화면 표시 → 잘못된 폰트!
```

**핵심**: 화면이 숨겨진 상태에서도 **게임 루프는 계속 실행**된다. 폰트 로드 전에 로고가 캐싱되면, 그 캐시는 영원히 유효한 것으로 남는다.

---

## 최종 해결책

### 1. 폰트 파일 로컬 저장 (`/public/fonts/`)

```
public/
  fonts/
    BlackHanSans-Regular.ttf  ← 구글 CDN 대신 로컬 서빙
    Orbitron-Black.ttf
```

**이유**: 구글 CDN 폰트는 Ctrl+F5 시 **인터넷에서 재다운로드**가 필요하다. 브라우저가 폰트를 가져오는 동안 게임 루프가 실행되면 Race Condition이 발생한다. 로컬 파일은 즉시 제공되므로 이 시간 간격이 사실상 0에 수렴한다.

```html
<!-- index.html -->
<style>
  @font-face {
    font-family: 'Black Han Sans';
    font-weight: 400 900;
    font-display: block; /* 로드될 때까지 렌더링 차단 */
    src: url('/fonts/BlackHanSans-Regular.ttf') format('truetype');
  }
</style>
```

### 2. `fontReady` 플래그로 Race Condition 원천 차단

```typescript
// TitleScreen.ts
private fontReady: boolean = false;

constructor() {
    // ...
    document.fonts.load(brandingFont).then(() => {
        this.fontReady = true;    // ✅ 폰트 준비 완료 신호
        this.logoCache = null;    // ✅ 오염된 캐시가 있다면 강제 초기화
        this.preRenderLogo();     // ✅ 올바른 폰트로 새로 캐싱
        requestAnimationFrame(() => {
            this.container.style.opacity = '1'; // ✅ 그 다음 화면 표시
        });
    });
}

private render() {
    // ...
    // ✅ fontReady가 true일 때만 preRenderLogo() 허용 → 오염 원천 차단
    if (this.fontReady) this.preRenderLogo();
}
```

---

## 교훈 및 향후 지침

### ⚠️ 외부 폰트(CDN)를 Canvas에서 사용 시 필수 체크리스트

1. **반드시 로컬 폰트 파일 사용**: Google Fonts CDN은 Ctrl+F5 등 캐시 초기화 시 네트워크 다운로드가 필요해 Race Condition 유발.
2. **`OffscreenCanvas`는 폰트 공유 안됨**: `document.createElement('canvas')`를 사용해야 main thread의 폰트 캐시를 공유함.
3. **게임 루프와 비동기 리소스는 반드시 플래그로 동기화**: 리소스가 로드되기 전에 게임 루프가 캐시를 오염시킬 수 있음.
4. **opacity: 0은 렌더링을 막지 않음**: CSS로 화면이 숨겨져 있어도 JS 코드는 계속 실행됨.

### 🚫 이 코드에서 하지 말아야 할 것들

- `OffscreenCanvas` 사용 (폰트 컨텍스트 미공유)
- `setTimeout`으로 폰트 로드를 기다리는 것 (환경마다 시간이 다름)
- 폰트 로드 완료 후 `logoCache = null` 초기화 없이 `preRenderLogo()` 호출
- 외부 CDN 폰트를 Canvas 텍스트에 사용하는 것

---

## 최종 커밋 내역

| 커밋 | 내용 |
|------|------|
| `fix: serve fonts locally` | CDN → 로컬 파일로 전환 |
| `fix: replace OffscreenCanvas with DOM canvas` | PC 폰트 컨텍스트 버그 수정 |
| `fix: block logo cache until fontReady flag` | Race Condition 완전 차단 |
