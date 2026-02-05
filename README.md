# NexusSphere: Multi-Genre Game Portal

본 프로젝트는 단일 에셋 풀과 고품질 오디오 시스템을 공유하며 다양한 장르의 게임을 즐길 수 있는 게임 포털 프로젝트입니다.

## 🏗️ 아키텍처 (Architecture)

- **Core System**: 오디오, 에셋, 입력 시스템을 중앙에서 관리합니다. (`src/core`)
- **Game Modules**: 리듬, 런너, 퍼즐 등 다양한 게임 장르를 모듈화하여 관리합니다. (`src/games`)
- **Shared Utilities**: 모든 게임과 포달에서 공통으로 사용되는 UI 및 유틸리티입니다. (`src/shared`)

## ⚖️ 개발 규범 (Governance)

본 프로젝트는 `development_rules.md`에 명시된 법적 규범을 따릅니다.

- **Strict TypeScript**: 모든 코드는 엄격한 타입을 준수합니다.
- **Data-Driven**: 게임 로직과 데이터는 분리되어 관리됩니다.
- **Asset Registry**: 하드코딩된 에셋 경로 사용을 금지하며, 중앙 레지스트리를 통해 참조합니다.

## 📁 폴더 구조 (Structure)

- `public/assets/`: 공통 이미지, MIDI, 사운드 폰트
- `src/core/`: 포털 핵심 엔진 (Audio, Asset, Input)
- `src/games/`: 개별 게임 장르 (rhythm, runner, puzzle 등)
- `src/portal/`: 포털 UI 및 게임 선택 로직
- `src/shared/`: 공통 컴포넌트 및 유틸 라이브러리

## 🚀 시작하기

```bash
npm install
npm run dev
```
