# Dumpit RE

부동산 사업장 관리 웹앱 — 공정율 · 자금집행 · 문서 업로드 · Q&A

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 기능 (MVP + Phase 2)

- **대시보드** — KPI, 월별 공정율 차트, 주의 사업장, 최근 문서
- **사업장** — 카드 그리드, 필터, 상세(공정·자금·문서 탭)
- **문서 업로드** — COST CM 기성실사 PDF 자동 파싱 → 사업장 데이터 반영
- **Q&A** — 키워드 기반 데모 응답 (RAG는 Phase 3)
- **로컬 저장** — `uploads/` 폴더에 원본 보관
- **Google Drive** — env 설정 시 연동 준비 (`lib/google-drive/client.ts`)

## 샘플 데이터

첨부해 주신 문서 기반 시드:

- 의정부 호원동 (제9회 기성실사)
- 광진 자양동 (제4회)
- 창동 SH매입 (제1회)
- 길동 투자제안서

## Supabase 연동

1. Supabase 프로젝트 생성
2. SQL Editor에서 migration 실행:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_phase3.sql`
3. `.env.local` 설정 (`.env.example` 참고)

상세: [`docs/SETUP_PHASE3.md`](docs/SETUP_PHASE3.md)

환경변수 없이도 **데모 모드**로 동작합니다.

## Phase 3 기능

- **Supabase** — 사업장/공정/자금/문서 영구 저장 (service role)
- **Google Drive** — 업로드 원본을 사업장별 폴더에 저장
- **RAG Q&A** — Gemini embedding + pgvector + Gemini chat (Hybrid SQL/RAG)
- **문서 인덱싱** — PDF 업로드 시 `document_chunks` 자동 생성

## 프로젝트 구조

```
app/           # 페이지 + API routes
components/    # UI, layout
lib/           # types, seed, analyzers, supabase
supabase/      # migrations
samples/       # 샘플 PDF
docs/          # 개발계획서
```

## 다음 단계

- [x] COST CM PDF 파서
- [x] Supabase repository + migration
- [x] Google Drive 업로드
- [x] RAG Q&A (pgvector + Gemini)
- [ ] Supabase Auth + RLS 강화
- [ ] Excel 공정율 파서
- [ ] Vercel 배포
