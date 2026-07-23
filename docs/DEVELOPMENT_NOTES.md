# Dumpit RE — 개발 노트

> **최종 갱신:** 2026-07-23 (v1.04)  
> **대상:** 부동산랩 사업장관리 웹앱 (Next.js · Supabase · Gemini)

---

## 1. 현재 제품 범위

| 영역 | 경로 | 역할 | 접근 |
|------|------|------|------|
| 전체 현황 | `/management` | 랩 목록 · 헤더 요약(진행/잔액/수수료) | 로그인 |
| 사업장별(회차) | `/management/sites` | 헤더 드롭다운 · 랩 상세 · **월별 공정율**(admin·wrap) · 조건 · 회차 · 진행 코멘트·첨부 | 로그인 |
| 분배금/만기일 | `/management/interest` | 분배·만기·중도상환 일정 · 달력 · 스케줄표 | 로그인 |
| 만기 캘린더 | `/management/interest/maturity` | 중도상환/대출만기/펀드만기 차트 | 로그인 |
| 설정·상환 추이 | `/management/setup-repayment` | 설정·상환 차트 | **관리자·wrap** |
| 수수료 추이 | `/management/fee-trend` | 수수료 차트 | **관리자·wrap** |
| 업체/지역별 | `/management/by-entity`, `by-region` | 집계 | **관리자·wrap** |
| 상품/사업장 | `/admin` | 제안서 매칭용 마스터 | 관리자 |
| 사업장관리 | `/admin/portfolio` | `lab_funds` CRUD | 관리자 |
| 공정율 현황 | `/admin/progress` | 랩별 최신 공정율 · active 미등록분 placeholder | 관리자 |
| 검토 대기함 | `/admin/review` | 업로드 후 수동 처리 큐 | 관리자 |
| Drive 연결 | `/admin/drive` | Google OAuth(내 드라이브) 연결 | 관리자 |
| 로그인 기록 | `/admin/login-logs` | guest 접속 IP·시각 | 관리자 |
| 업로드 | `/upload` | 관리현황 · 제안서 · 공정율 | 관리자 |

---

## 2. 인증 (v1.04)

- **로그인 필수**: `middleware.ts` — `/login`, `/api/auth/*` 제외 전 경로
- **계정** (비밀번호는 코드에 없음, `.env.local` / Vercel env)
  - `admin` — 관리자 (관리자 메뉴 + 전체 현황 전체)
  - `wrap` — 일반 + 전체 현황 서브메뉴 전체 (설정·상환/수수료/업체별/지역별) + **월별 공정율**
  - `guest` — 일반 (조회 위주, 월별 공정율·제한 메뉴 제외)
- **환경 변수**: `DUMPIT_ADMIN_PASSWORD`, `DUMPIT_GUEST_PASSWORD`, `DUMPIT_WRAP_PASSWORD`
- **guest 로그인 로그**: Supabase `guest_login_logs` 또는 로컬 `.data/guest-login-logs.json`
- **폰트**: Pretendard npm (`pretendard` → `globals.css` import)

---

## 3. 데이터 모델 (핵심)

### 3.1 `lab_funds` (마스터)

관리현황 엑셀·제안서·사업장관리에서 관리하는 **랩 1행**.

- 금액·금리·수수료·주소·사업자
- 날짜: `setup_date`, `early_repayment_date`(중도상환), `maturity_date`(펀드만기), `loan_maturity_date`, `repayment_date`(상환일)
- `interest_payments` JSONB (회차별 지급일)
- `planned_progress_pct` / `actual_progress_pct` — 마스터에 남아 있으나 **사업장관리 화면에서는 숨김**. 화면 실행공정율은 `lab_progress` 병합값 우선

### 3.2 `lab_progress` (공정 시계열)

- **랩 × 확인일** 1행 (unique: `lab_name, confirmed_date`)
- 공정율 현황 = 랩별 **최신 확인일** 1건
- **active 랩**에 공정 행이 없으면 `{id}--placeholder` 행을 자동 생성 (`ensureActiveLabProgressPlaceholders`)
- **기성실사보고서**: 합계 행(누계계획/실적/달성률) 파싱
- **공정확인서**(1~2장): 계획(%)/실적(%)/대비·달성률 + 표 아래 확인일  
  - 텍스트 PDF: `gisung-progress` 표 패턴  
  - 스캔 PDF: Gemini (`extractProcessConfirmFromPdf`) — `GEMINI_API_KEY` 필요
- 이력: `GET /api/lab-progress?history=1&labName=…` — **사업장별 상세「월별 공정율」**에 표시
- 미제출: `GET /api/lab-progress?missing=1` (active 랩 × 해당 월)
- 시드/재처리: `scripts/seed-progress-placeholders.mts`, `scripts/reprocess-process-confirms.mts`
- **진행현황 첨부**: `lab_funds.progress_attachments` (PDF·이미지 메타 JSONB)
  - 업로드: OAuth 연결 시 **내 드라이브** 우선, 실패 시 로컬 `uploads/progress/{fundId}/`
  - UI: 코멘트 박스 내 썸네일 · 클릭 시 원본 (`pdfjs-dist`로 PDF 1페이지)
  - 관리자 Drive 연결: `/admin/drive` (`GOOGLE_OAUTH_*`, 토큰 `.data/google-drive-oauth.json`)

### 3.2.1 검토 대기함 (`review_queue`)

- 공정 매칭 실패 · 구자료 덮어쓰기 · **공정율 추출 실패** · 제안서 등록
- 「처리하기」→ `/upload?reviewId=…&focus=progress` 로 대기 payload 복원 후 매칭 UI 표시

### 3.3 `product_master` / `review_queue`

- 상품 등록 영구 저장 (재시작·배포 유지)
- 업로드 후 매칭·제안서 등록·추출 실패 건을 검토 대기함에 적재

### 3.4 날짜 필드 의미 (UI 표기)

| DB 컬럼 | 화면 표기 | 비고 |
|---------|-----------|------|
| `early_repayment_date` | **중도상환일** / 중도상환(예정)일 | 예정·중도 상환 (별도 필드) |
| `repayment_date` | **상환일** | 확정 상환 · 상환완료 판별에 사용 |
| `loan_maturity_date` | 대출만기일 | 사업장별 상세에서는 항상 표시 |
| `maturity_date` | 펀드만기일 | 사업장별 상세에서는 항상 표시 |

분배금/만기일 스케줄·일부 목록에서는 상환일이 있으면 대출·펀드 만기·회차 지급일을 숨길 수 있음 (DB 값은 유지).

### 3.5 표시 규칙

- **잔액** `null` 또는 `0` → `-` (`formatBalance`)
- **복수 주소/값**: 서로 다른 행정구역(시·군·구·동 등)만 줄바꿈; `275-3, 3-204` 같은 필지 연속은 한 줄

---

## 4. 업로드 후 리다이렉트

| 문서 | 완료 후 |
|------|---------|
| 관리현황 엑셀 | `/admin/portfolio` |
| 제안서 (등록 저장 완료) | `/admin/portfolio` |
| 공정율 (자동/수동 반영 완료) | `/admin/progress` |

제안서·공정율 매칭이 남아 있으면 업로드 화면에 머묾. 미처리는 `/admin/review`.

---

## 5. 운영 체크리스트

1. Supabase SQL: `001` → `007` 순서 실행
2. `.env.local`: Supabase + `DUMPIT_ADMIN_PASSWORD`, `DUMPIT_GUEST_PASSWORD`, `DUMPIT_WRAP_PASSWORD` + (선택) Gemini, Drive
3. Vercel 배포 시 동일 env 설정 후 재배포
4. 관리현황 엑셀 업로드 → 사업장관리 확인
5. guest 로그인 → `/admin/login-logs`에서 기록 확인
6. (선택) 공정율 placeholder 시드: `npx tsx scripts/seed-progress-placeholders.mts`
7. (선택) 공정확인서 재처리: `npx tsx scripts/reprocess-process-confirms.mts` (uploads/ + Gemini)

---

## 6. 알려진 한계 / 다음

- 자금집행 Excel 파서 미구현 (문서 유형 옵션 제거됨)
- Q&A는 레거시 site 모델 비중 — `lab_funds`/`lab_progress` 연동 강화 여지
- 데모 cookie auth — 프로덕션 전 Supabase Auth + RLS 권장
- 공정율 이력 UI: 사업장별 상세「월별 공정율」에 확인일별 표 표시 (관리자 공정율 현황은 최신 1건)

---

## 7. 관련 문서

- [변경 이력](./CHANGELOG.md)
- [Phase 3 설정](./SETUP_PHASE3.md)
- [개발계획서](./DEVELOPMENT_PLAN.md)
