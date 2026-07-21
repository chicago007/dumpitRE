# Dumpit RE — 개발 노트

> **최종 갱신:** 2026-07-21  
> **대상:** 부동산랩 사업장관리 웹앱 (Next.js · Supabase · Gemini)

---

## 1. 현재 제품 범위

| 영역 | 경로 | 역할 |
|------|------|------|
| 전체 현황 | `/management` | 랩 목록 · 잔액/설정액 · 실행공정율 |
| 사업장별(회차) | `/management/sites` | 랩 상세 · 조건 · 회차 이자 · 공정율/상환일 |
| 분배금/만기일 | `/management/interest` | 분배·만기·중도상환 일정 · 달력 · 스케줄표 |
| 만기 캘린더 | `/management/interest/maturity` | 중도상환/대출만기/펀드만기 차트 |
| 상품/사업장 | `/admin` | 제안서 매칭용 마스터 (Supabase `product_master`) |
| 사업장관리 | `/admin/portfolio` | `lab_funds` CRUD · 엑셀 연동 |
| 공정율 현황 | `/admin/progress` | 랩별 최신 공정율 · 미제출 배너 |
| 검토 대기함 | `/admin/review` | 업로드 후 수동 처리 큐 |
| 업로드 | `/upload` | 관리현황 · 제안서 · 공정율 |

---

## 2. 데이터 모델 (핵심)

### 2.1 `lab_funds` (마스터)

관리현황 엑셀·제안서·사업장관리에서 관리하는 **랩 1행**.

- 금액·금리·수수료·주소·사업자
- 날짜: `setup_date`, `early_repayment_date`(중도상환), `maturity_date`(펀드만기), `loan_maturity_date`, `repayment_date`(상환일)
- `interest_payments` JSONB (회차별 지급일)
- `planned_progress_pct` / `actual_progress_pct` — 마스터에 남아 있으나 **사업장관리 화면에서는 숨김**. 화면 실행공정율은 `lab_progress` 병합값 우선

### 2.2 `lab_progress` (공정 시계열)

- **랩 × 확인일** 1행 (unique: `lab_name, confirmed_date`)
- 공정율 현황 = 랩별 **최신 확인일** 1건
- 이력: `GET /api/lab-progress?history=1&labName=…`
- 미제출: `GET /api/lab-progress?missing=1` (active 랩 × 해당 월)

### 2.3 `product_master` / `review_queue`

- 상품 등록 영구 저장 (재시작·배포 유지)
- 업로드 후 매칭·제안서 등록·추출 실패 건을 검토 대기함에 적재

### 2.4 날짜 필드 의미 (UI 표기)

| DB 컬럼 | 화면 표기 | 비고 |
|---------|-----------|------|
| `early_repayment_date` | **중도상환일** / 중도상환(예정)일 | 예정·중도 상환 (별도 필드, 기존 데이터는 공란) |
| `repayment_date` | **상환일** | 확정 상환 · 상환완료 판별에 사용 |
| `loan_maturity_date` | 대출만기일 | |
| `maturity_date` | 펀드만기일 | |

`repayment_date`와 `early_repayment_date`는 **다른 값**입니다.

---

## 3. 업로드 후 리다이렉트

| 문서 | 완료 후 |
|------|---------|
| 관리현황 엑셀 | `/admin/portfolio` |
| 제안서 (등록 저장 완료) | `/admin/portfolio` |
| 공정율 (자동/수동 반영 완료) | `/admin/progress` |

제안서·공정율 매칭이 남아 있으면 업로드 화면에 머묾. 미처리는 `/admin/review`.

---

## 4. 운영 체크리스트

1. Supabase SQL: `001` → `005` 순서 실행
2. `.env.local`: Supabase + (선택) `GEMINI_API_KEY`, Google Drive
3. 관리현황 엑셀 업로드 → 사업장관리 확인
4. 기성 PDF 업로드 → 공정율 현황 · 미제출 배너
5. 표지 일자 깨진 PDF → Gemini 복구 (전체 PDF 전송)

---

## 5. 알려진 한계 / 다음

- 자금집행 Excel 파서 미구현 (문서 유형 옵션 제거됨)
- Q&A는 레거시 site 모델 비중 — `lab_funds`/`lab_progress` 연동 강화 여지
- 데모 cookie auth — 프로덕션 전 Supabase Auth + RLS 권장
- 공정율 이력 전용 UI(랩 클릭 시 월별 추이)는 API만 있고 화면은 최신값 중심

---

## 6. 관련 문서

- [변경 이력](./CHANGELOG.md)
- [Phase 3 설정](./SETUP_PHASE3.md)
- [개발계획서](./DEVELOPMENT_PLAN.md)
