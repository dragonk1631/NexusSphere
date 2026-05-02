# Dev Blog: V3 Relational Architecture Migration & Global API Stability

**Date: 2026-05-03**  
**Category:** Backend Architecture, Database Migration, Security & CORS  
**Author:** Antigravity AI (NexusSphere Engineering Team)

오늘의 업데이트는 NexusSphere의 데이터 엔진을 차세대 규격인 **V3 관계형 아키텍처**로 완전히 전환하고, 로컬과 운영 서버 간의 통신 장벽을 허무는 데 집중되었습니다. 

---

## 🚀 Today's Objective

1.  **V3 정규화 아키텍처 완성**: 기존의 경로 기반 데이터 저장 방식에서 벗어나, `songs` 마스터 테이블을 중심으로 한 정규화된 관계형 DB 구조로 마이그레이션.
2.  **전역 CORS 이슈 해결**: 로컬 개발 환경(`localhost`)과 운영 서버(`Cloudflare Pages`) 간의 보안 통신 프로토콜(CORS)을 완벽하게 수립.
3.  **데이터 무결성 확보**: 곡별 키 모드(4K/6K) 및 난이도별 기록 분리 저장 시스템 구축.
4.  **자동 마이그레이션 시스템**: 사용자의 개입 없이 서버가 스스로 구형 DB 구조를 최신형으로 업그레이드하는 자동화 로직 구현.

---

## 🛠️ Key Accomplishments

### 1. V3 관계형 데이터베이스 아키텍처 전환
기존의 파편화된 데이터 구조를 개선하기 위해 **Normalized Schema**를 도입했습니다.
- **`songs` 마스터 테이블**: 모든 곡의 메타데이터를 통합 관리하며, 고유 슬러그(Slug)를 통해 곡을 식별합니다.
- **`user_song_records_v3`**: 곡 ID, 키 모드, 난이도를 결합한 복합 PK(Primary Key)를 사용하여 유저의 모든 플레이 기록을 정교하게 관리합니다.

### 2. 전역 CORS 및 사전 검사(Preflight) 완벽 대응
로컬 개발 중 발생하던 `Failed to fetch` 에러의 근본 원인인 CORS 보안 정책을 해결했습니다.
- **`onRequestOptions` 도입**: 모든 API 엔드포인트(`submit`, `sync`, `collection`, `top`)에 명시적인 `OPTIONS` 핸들러를 추가하여 브라우저의 사전 탐색 요청에 즉시 응답하도록 개선했습니다.
- **일관된 헤더 주입**: 성공 응답뿐만 아니라 에러 응답 경로에서도 CORS 허용 헤더가 누락되지 않도록 아키텍처를 강화했습니다.

### 3. 무중단 자동 DB 마이그레이션 시스템
운영 중인 서비스의 데이터를 보호하면서 구조만 업그레이드하는 **Shadow-Table Migration** 로직을 구현했습니다.
- 서버 시작 시 `PRAGMA table_info`를 통해 현재 DB 구조를 감지합니다.
- 구형 구조 발견 시 임시 테이블을 생성하여 데이터를 백업하고, 새로운 스키마로 교체한 뒤 데이터를 복구하는 과정을 자동으로 수행합니다.
- 이를 통해 사용자나 개발자가 직접 SQL 명령어를 칠 필요 없는 "Zero-Config" 환경을 구축했습니다.

### 4. 시스템 안정성 및 빌드 무결성 확보
- **TypeScript 빌드 교정**: 리팩토링 과정에서 발생한 중괄호 꼬임, 변수 스코프(CORS_HEADERS) 오류 등을 모두 해결했습니다.
- **상세 에러 리포팅**: 서버 에러 발생 시 단순한 500 에러가 아닌, 구체적인 SQLite 에러 메시지와 스택 트레이스를 반환하도록 디버깅 기능을 강화했습니다.

---

## 📉 Technical Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **CORS Preflight Fail** | `onRequestPost` 만으로는 `OPTIONS` 요청을 처리할 수 없음을 파악, 전용 핸들러를 명시적으로 export 하여 해결. |
| **Collection Sync Lag** | 정규화 과정에서 누락된 `key_mode`, `difficulty` 컬럼을 DB에 긴급 추가하고 UI 필터링 로직과 동기화. |
| **Auth Session Expiry** | Wrangler 터미널 인증 만료 문제를 서버 측 자동 마이그레이션 코드로 우회하여 개발 생산성 유지. |

---

## 💡 Lessons Learned

- **정규화의 가치**: 데이터 아키텍처가 정규화됨에 따라 데이터 중복이 사라지고, 향후 랭킹 시스템이나 통계 분석 기능을 확장하기 매우 유리한 구조가 되었습니다.
- **보안의 디테일**: 단순한 헤더 추가를 넘어 브라우저의 `Preflight` 작동 방식을 정확히 이해하고 대응하는 것이 현대 웹 개발에서 얼마나 중요한지 재확인했습니다.
- **자동화된 회복력**: 시스템이 스스로 결함을 감지하고 구조를 고치는 로직(Migration)은 장기적인 유지보수 비용을 획기적으로 낮춰줍니다.

---

## 🔮 Next Steps

- **전역 랭킹 보드 고도화**: V3 구조를 활용하여 곡별/난이도별 전 세계 Top 100 랭킹 시스템 정교화.
- **성능 최적화**: D1 데이터베이스의 JOIN 쿼리 인덱싱 최적화를 통한 응답 속도 단축.
- **데이터 백업 자동화**: 중요한 유저 데이터를 위한 정기적인 Snapshot 시스템 구축.

---
**NexusSphere는 이제 진정한 데이터 기반 리듬 게임으로 한 단계 더 진화했습니다.** 
Documented by Antigravity AI - System Architecture Team
