# NexusSphere: Responsive & High-Fidelity UI Implementation Guide

This document serves as a reference for the design principles and technical implementation methods established during the **Result Screen Overhaul (Stage 4.3)**. These patterns should be applied to all future rhythm game UI screens to ensure a consistent, premium, and cross-platform experience.

## 1. The Landscape-Only Law (최우선 철칙) ⚖️

본 게임은 **모든 플랫폼과 기기에서 무조건 가로 모드(Landscape) 전체 화면**으로 구동되는 것을 대전제로 합니다.

- 세로 모드(Portrait) 레이아웃은 구현하지 않으며, 모든 UI 설계와 좌표 계산은 가로 모드를 기준으로 수행되어야 합니다. 기기가 세로 방향일 경우에도 UI는 가로 모드 비율을 유지하며 맞춰져야 합니다.

## 2. Responsive Layout Patterns

### Dynamic Adaptive Strategy

가로 모드 고정 원칙하에, 화면의 가로세로 비(Aspect Ratio) 변화에 대응하여 UI를 배치합니다.

- **Ultra-Wide / Desktop:** 좌우 여백을 충분히 확보하고 컴포넌트를 균형 있게 배치합니다.
- **Mobile Landscape:** 좁은 세로 폭을 고려하여 폰트 크기와 패딩을 공격적으로 조절하며, 인터랙티브 요소(버튼 등을) 터치 친화적으로 배치합니다.

## 3. Universal Scaling System

### The `scaleFactor` Logic

To handle everything from 4K monitors to small smartphone screens, use a centralized `scaleFactor` derived from a logical base resolution.

```typescript
// 1. Define logical base dimensions (Landscape Only)
const baseWidth = 1200;
const baseHeight = 800;

// 2. Calculate raw scale
let scaleFactor = Math.min(width / baseWidth, height / baseHeight);
scaleFactor = Math.max(0.6, scaleFactor) * 1.15; // Visibility boost
```

## 4. Auto-Fit Typography (Overflow Prevention)

### Dynamic Text Measurement

Never assume a string will fit in a box. Use `ctx.measureText()` to guarantee container integrity.

**Implementation Steps:**

1. Define a `maxAvailableWidth` for the text container.
2. Measure the text width at the target font size.
3. If it exceeds `maxAvailableWidth`, calculate a `shrinkFactor` and reduce font size on-the-fly.

## 5. Visual Aesthetics & Theme Integration

### Premium "Glassmorphism"

- **Backgrounds:** Use high-opacity dark fills (`rgba(5, 5, 15, 0.9)`) for panels to ensure maximum legibility for bright text.
- **Borders:** Apply glowing neonatal strokes using the theme's `scorePanel` palette property.

### Typography Standard

- **Font:** Always use `"Orbitron"` for tech/cybernetic screens.
- **Weights:**
  - `900 (Black)` for critical data.
  - `700 (Bold)` or `400 (Regular)` for labels and hints.
