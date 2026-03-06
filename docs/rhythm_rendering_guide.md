# Rhythm Game Highway Rendering Guide

이 문서는 NexusSphere 리듬 게임의 하이웨이 렌더링 엔진과 정렬 정밀도를 유지하기 위한 기술 가이드를 제공합니다.

## 1. 핵심 정렬 원리 (Alignment Precision)

하이웨이의 중앙 정렬과 레인 폭의 정확성은 게임 플레이의 정밀도와 직결됩니다.

- **서브픽셀 정밀도 (Sub-pixel Precision)**:
  - `PerspectiveUtils.getPerspectiveX` 및 관련 정렬 로직에서 `Math.floor`나 `Math.round`의 사용을 지양해야 합니다.
  - 홀수 픽셀 너비의 화면에서도 하이웨이가 완벽하게 중앙에 위치하도록 Canvas API의 서브픽셀 렌더링 기능을 최대한 활용합니다.
- **laneBottomWidth 의 역할**:
  - `laneBottomWidth`는 단순한 디자인 수치가 아니라, 판정 영역의 핵심 기준점입니다.
  - 현재 기본값은 **120px**이며, 이는 판정노트(리셉터)의 핵심 렌더링 폭인 100px에 20px의 여유 공간을 더한 값입니다.

## 2. 렌더링 캐시 및 범위 (Caching & Range)

성능 최적화를 위해 하이웨이의 원근 좌표는 캐싱됩니다.

- **캐시 범위 (IMPORTANT)**:
  - 캐시 데이터(`perspectiveXCache`, `perspectiveWidthCache`)는 반드시 하이웨이의 하단 끝점인 `bottomY`까지 생성되어야 합니다.
  - **주의**: 범위를 `hitLineY`(판정선)로 제한할 경우, 판정선 아래 영역에서 레인이 더 이상 확장되지 않고 수직으로 내려오게 되어 리셉터와의 정렬이 깨지게 됩니다.
- **이미지 스케일링**:
  - 리셉터 및 노트 렌더링 시 `RenderCache`에서 생성된 이미지의 원본 폭 정보를 바탕으로 `paddingRatioX/Y`를 계산하여 드로잉 영역을 결정합니다.

## 3. 시각적 품질 가이드 (Visual Quality)

- **리셉터 채우기**: 리셉터 내부는 은은한 그라데이션(약 20~30% 불투명도)으로 채워 디자인의 밀도를 유지합니다.
- **지면 광원 (Ground Light)**: 리셉터 하단에 `screen` 합성 모드를 이용한 지면 광원을 추가하여 레인 위에 안정적으로 안착된 느낌을 줍니다.
- **스킨 일관성**: 새로운 노트 스킨 추가 시 `RenderCache`의 `createCachedReceptor`와 `createCachedNote`에서 동일한 하이라이트/채우기 로직을 적용해야 합니다.
