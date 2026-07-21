# Dumpit RE — 변경 이력

형식: 최신 날짜가 위. 배포 단위·기능 단위로 요약.

---

## 2026-07-21

### v1.01

- 버전 `v1.01` (`lib/version.ts`)
- **인증·접근**
  - 전 페이지 로그인 필수 (`middleware.ts`, `RequireAuth`)
  - 고정 계정: `admin` / `guest` — 비밀번호는 `.env` (`DUMPIT_ADMIN_PASSWORD`, `DUMPIT_GUEST_PASSWORD`)
  - guest 로그인 기록 (`guest_login_logs`, `/admin/login-logs`)
  - 수수료 추이 · 설정·상환 추이 · 업체별/지역별 현황 → **관리자만**
- **로그인·고지**
  - 임직원 고지문을 로그인 화면 상단으로 이동 (헤더 고지 제거)
  - 제목: 「LH/SH/GH 매입약정 부동산랩 현황관리」
- **UI/UX**
  - 전체 현황: 진행 비중·잔액/설정액·누적수수료를 헤더 제목 옆에 표시
  - 사업장별(회차): 왼쪽 호수 목록 → 헤더 드롭다운 (`부동산랩 N호/펀드M호`)
  - 만기 캘린더: 중도상환/대출만기/펀드만기 토글에 차트 색상 표시
  - 사업장 주소: 서로 다른 지역만 줄바꿈 (필지 번호 `275-3, 3-204`는 한 줄 유지)
  - 잔액 없음/0 → `-` 표시 (`formatBalance`)
  - **상환일** 있는 랩: 대출·펀드 만기일·분배금 지급일 UI 숨김 (데이터 유지)
  - 사이드바 브랜드 줄바꿈 방지

### v1.00

- 버전 관리 시작. 사이드바 「부동산랩 사업장관리」 옆에 `v1.00` 표시 (`lib/version.ts`)

### 중도상환일 · 상환일 분리

- `repayment_date` = **상환일** (기존 데이터 유지)
- `early_repayment_date` = **중도상환일** (신규 컬럼, 기존 건은 공란)
- 사업장별 헤더 공정율 옆 상환일 박스 제거 → 조건란 원래 위치로 복귀
- 만기/캘린더의 중도상환은 `early_repayment_date`만 사용

### 사업장관리 · 만기/중도상환 UX

- **사업장관리** (`/admin/portfolio`)
  - 실행공정(%) · 계획공정(%) 컬럼 제거
  - 비고를 잔액 옆으로 이동
  - 설정일 ↔ 펀드만기일 사이에 **중도상환일** 컬럼 (초기 공란)
  - 상환일은 대출만기일 뒤 원래 위치에 `repaymentDate` 표시
- **사업장별(회차)** (`/management/sites`)
  - 조건란: 중도상환(예정)일 · 상환일 분리
- **분배금/만기일 · 만기 캘린더**
  - 중도상환 / 대출만기 / 펀드만기 토글 분리

### 문서

- `docs/DEVELOPMENT_NOTES.md` · `docs/CHANGELOG.md` 추가

---

## 2026-07-20

### 검토 대기함 · 공정 시계열 · 마스터 영구저장 (`2ccfff1`)

- `005_product_review_progress_history.sql`
  - `product_master`, `review_queue`
  - `lab_progress` unique: 랩당 1행 → `(lab_name, confirmed_date)`
- `/admin/review` 검토 대기함
- 공정율 현황: 이번 달 미제출 배너, 확인일별 이력 저장
- 상품/사업장 → Supabase `product_master` 영속화
- 업로드: 자금집행 유형·업로드 큐 제거
- 리다이렉트: 관리현황/제안서 → 사업장관리, 공정율 → 공정율 현황

### 기성보고서 공정율 파이프라인 (`51075c9`)

- 기성 PDF/필증 이미지 → `lab_progress` 매칭·저장
- 동일 주소(47·48호 등) 수동 확인 UI
- Gemini 표지 확인일 복구 (전체 PDF)
- `/admin/progress` 공정율 현황 (소수 2자리)
- 상품/사업장 목록에서 규모 컬럼 제거

### 포트폴리오·수수료 UX (`64362fe` 이전)

- 진행중/상환 상태 파생 수정, 수수료 억 단위 표시
- 업체별·지역별 필터, 지도 팝업, 브랜드 스타일
- `lab_funds` Supabase 공유 (`79aa185`)

---

## 마이그레이션 인덱스

| 파일 | 내용 |
|------|------|
| `001_initial.sql` | sites · documents · 레거시 |
| `002_phase3.sql` | RAG · chat |
| `003_lab_portfolio.sql` | lab_funds · meta |
| `004_lab_progress.sql` | lab_progress (초기) |
| `005_product_review_progress_history.sql` | product_master · review_queue · 공정 시계열 unique |
| `006_early_repayment_date.sql` | lab_funds.early_repayment_date (중도상환일) |
| `007_guest_login_logs.sql` | guest 로그인 기록 |

신규 환경은 **001→007 순서**로 실행.
