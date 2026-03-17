# NexusSphere Technika Tone & Manner Master Guide (v21)

이 문서는 NexusSphere 프로젝트의 **공식 디자인 시스템 및 톤앤매너(Tone & Manner)**를 정의합니다. DJMAX Technika 시리즈의 '고광택(High-Gloss)', '스펙트럼(Spectrum)', '아케이드(Arcade)' 미학을 유지하기 위한 모든 가이드라인을 포함합니다.

## 🌟 디자인 철학 (Design Philosophy)

1. Vibrant Energy: 생동감 넘치는 원색과 스펙트럼 그라데이션을 통해 에너지를 전달합니다.
2. Glassy & Liquid: 모든 요소는 투명한 유리 또는 흐르는 액체와 같은 광택을 가져야 합니다.
3. Heavy Impact: 두꺼운 고딕 폰트와 선명한 외곽선을 사용하여 아케이드의 묵직한 타격감을 시각화합니다.
4. Premium Gloss: 단순한 색상이 아닌 멀티 레이어 광택 효과를 통해 상업용 게임 수준의 퀄리티를 지향합니다.

## 🎨 테마 컬러 (Core Palette)

| 요소 | 색상 프로젝트명 | Hex 코드 | 주요 용도 |
| :--- | :--- | :--- | :--- |
| **Primary Accent** | Technika Pink | `#ff006e` | 강조 문구, 솔로 모드, 활성 상태 |
| **Secondary Accent** | Technika Yellow | `#ffd000` | 에디터 모드, 하이라이트 |
| **Tertiary Accent** | Technika Green | `#a2ff00` | 게임 모드, 성공 상태 |
| **Quaternary Accent** | Technika Blue | `#00d2ff` | 네비게이션, HUD 포인트 |
| **Background (Start)** | Lilac Calm | `#a5b4fc` | 전체 배경 그라데이션 시작점 |
| **Background (End)** | Pink Mist | `#fbc2eb` | 전체 배경 그라데이션 종료점 |

## 🌈 스펙트럼 그라데이션 (v15+ Spectrum)

모든 주요 UI 요소에는 135deg 각도의 3단계 스펙트럼 그라데이션을 사용하여 단조로움을 피합니다.

### 1. 글로벌 대기 (Atmosphere)

`linear-gradient(135deg, #a5b4fc 0%, #fbc2eb 100%)`

### 2. 표준 스펙트럼 (Standard Gradients)

- Solo Spectrum: `linear-gradient(135deg, #ff006e 0%, #ff8040 50%, #ffd000 100%)`
- Editor Spectrum: `linear-gradient(135deg, #ffd000 0%, #d0ff00 50%, #a2ff00 100%)`
- Pong Spectrum: `linear-gradient(135deg, #a2ff00 0%, #00ffca 50%, #00d2ff 100%)`
- Shop Spectrum: `linear-gradient(135deg, #00d2ff 0%, #7000ff 50%, #ff006e 100%)`

## 🔠 타이포그래피 표준 (v17+ Typography)

아케이드의 묵직함과 가독성을 위한 **1px 외곽선 고딕 스타일**을 표준으로 합니다.

### 1. 전용 폰트 (Fonts)

- Main Heading/Labels: `'Black Han Sans'` (Angular Gothic)
- Sub-Info/Body: `'Outfit'` (Bold Sans-serif, 900 weight)

### 2. 외곽선 및 입체 효과 (Robust Rendering)

배경 클리핑(`background-clip: text`)과 외곽선 효과를 동시에 적용할 때는 브라우저 렌더링 호환성을 위해 `filter: drop-shadow`를 중첩하여 사용합니다.

```css
/* 글로벌 마스터 텍스트 스타일 (v21 렌더링 표준) */
.nexus-text-master {
    font-family: 'Black Han Sans', sans-serif;
    font-weight: 900;
    text-transform: uppercase;
    display: inline-block;
    
    /* 그라데이션 클리핑 */
    background: linear-gradient(to bottom, #fff, #cadbff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;

    /* 1px 정밀 외곽선 및 네온 글로우 (v21 Filter Standard) */
    filter: 
        drop-shadow(-1px -1px 0 #000) 
        drop-shadow(1px -1px 0 #000) 
        drop-shadow(-1px 1px 0 #000) 
        drop-shadow(1px 1px 0 #000)
        drop-shadow(0 0 15px rgba(165,180,252,0.6));
}
```

## ✨ 비주얼 이펙트 (Visual Effects)

### 1. 리퀴드 시스루 광택 (Liquid Sheen)

상용 버튼 상단 60%를 덮는 비스듬한 광택 층입니다.

```css
.liquid-gloss::after {
    content: '';
    position: absolute;
    top: -10%; left: -10%; right: -10%; height: 60%;
    background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.55) 0%, 
        rgba(255, 255, 255, 0.15) 45%, 
        transparent 100%);
    transform: skewY(-5deg);
    pointer-events: none;
    z-index: 2;
}
```

### 2. 컴포지트 글로우 (Composite Glow)

```css
.technika-glow:hover {
    box-shadow: 
        0 20px 45px rgba(0, 0, 0, 0.3), 
        0 0 30px currentColor;
}
```

## 🏗️ 레이아웃 상시 규격 (Technical Constraints)

- 버튼 비율: `1.25 : 1` 고정 (가로형 아케이드 비율)
- 모서리 굴곡: `clamp(16px, 3.5vh, 32px)` 원형 디자인 지향
- 여백 정책: 컨테이너 최소 `20px` 이상의 숨 쉴 공간(Breathing Room) 확보

---

Last Updated: 2026-03-17 (v21 Master Tone & Manner Guide)
