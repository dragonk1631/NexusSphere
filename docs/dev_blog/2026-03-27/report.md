# Dev Blog: Local MIDI Support & UI Refinements
**Date:** 2026-03-27
**Status:** Feature Complete & Polished

## 1. Overview
커스텀 미디(MIDI) 파일을 유저가 직접 등록하고 플레이할 수 있는 기능을 구현했습니다. 단순한 파일 선택을 넘어, 대량의 곡을 관리하기 위한 폴더 단위 업로드와 안정적인 데이터 보관(IndexedDB)을 지원합니다.

## 2. Technical Implementation
- **IndexedDB Storage**: 대용량 미디 파일을 브라우저에 영구적으로 보존하기 위해 `IndexedDB`를 사용한 `LocalSongStorage`를 구축했습니다.
- **Batch Upload**: `webkitdirectory` 및 `multiple` 속성을 활용해 수십 개의 곡이 포함된 폴더 전체를 한 번에 가져올 수 있는 기능을 구현했습니다.
- **Background Metadata Parsing**: 수만 줄의 미디 데이터를 분석하여 BPM과 곡 길이를 추출하는 작업을 백그라운드 큐(Queue)로 처리하여 메인 UI의 버벅임(Stuttering)을 방지했습니다.

## 3. UI/UX Refinements
사용자 경험을 극대화하기 위해 세 차례에 걸친 디자인 고도화를 진행했습니다.
- **Compact Header**: 모바일 화면에서도 즐겨찾기 탭과 겹치지 않도록 업로드 버튼을 아이콘(`📂+`) 중심으로 슬림화하고, 탭 영역을 동적으로 계산하도록 레이아웃을 최적화했습니다.
- **Visual Identity**: 공식 곡과 유저 곡을 시각적으로 구별하기 위해 유저 곡에 은은한 **Ice-Blue(#e0f0ff)** 컬러와 **Magenta Shadow** 글로우 효과를 적용했습니다.
- **Management Flow**: 
    - 삭제 버튼을 **휴지통(🗑️)** 아이콘으로 교체하고, 실수 방지를 위해 '선택된 곡'에만 노출되도록 필터링했습니다.
    - 곡 삭제 시 현재 재생 중인 미리듣기를 즉시 중단하고, 다음 곡을 자동으로 재생하는 부드러운 전환 로직을 추가했습니다.

## 4. Stability & Bug Fixes
- **Favorite Persistence**: 곡 목록 갱신 시 `localStorage`의 즐겨찾기 데이터가 누락되는 동기화 버그를 해결했습니다.
- **PC Scrollbar Sync**: PC 브라우저(7개 표시)와 모바일(5개 표시)의 서로 다른 목록 높이를 감지하여 스크롤바 트랙 높이가 정확하게 일치하도록 수정했습니다.

## 5. Conclusion
이제 NexusSphere는 유저의 로컬 라이브러리를 게임 내에서 마치 공식 콘텐츠처럼 자연스럽고 화려하게 즐길 수 있는 강력한 커스텀 환경을 갖추게 되었습니다.

---
*NexusSphere Development Team*
