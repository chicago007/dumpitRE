# Phase 3 설정 가이드

## 1. Supabase

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 순서대로 실행:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_phase3.sql`
   - `supabase/migrations/003_lab_portfolio.sql`
   - `supabase/migrations/004_lab_progress.sql`
   - `supabase/migrations/005_product_review_progress_history.sql`
   - `supabase/migrations/006_early_repayment_date.sql`
   - `supabase/migrations/007_guest_login_logs.sql`
   - `supabase/migrations/008_progress_attachments.sql`
3. `.env.local` 설정:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

4. `npm run dev` 재시작 → Supabase 모드 자동 활성화

## 2. Google Drive

### 권장: OAuth (개인 내 드라이브)

서비스 계정은 **내 드라이브에 파일 생성 불가**(용량 0). 개인 Gmail은 OAuth를 사용합니다.

1. Google Cloud Console → **Drive API** 사용 설정
2. **OAuth 클라이언트 ID**(웹 애플리케이션) 생성
3. 승인된 리디렉션 URI:
   ```
   http://localhost:3000/api/google-drive/oauth/callback
   ```
4. OAuth 동의 화면이 **테스트**면 테스트 사용자에 본인 Gmail 추가
5. `.env.local`:

```env
GOOGLE_OAUTH_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-drive/oauth/callback
GOOGLE_DRIVE_ROOT_FOLDER_ID=1abc...folderId
```

6. 관리자 → **Drive 연결** (`/admin/drive`) → **Google 계정 연결**
7. 토큰은 `.data/google-drive-oauth.json`에 저장 (gitignore). Vercel이면 `GOOGLE_OAUTH_REFRESH_TOKEN`도 가능

업로드 시 `{사업장명}/02_공정율/` 하위에 저장됩니다.

### 선택: 서비스 계정 (공유 드라이브만)

Google Workspace **공유 드라이브** + 서비스 계정 멤버(콘텐츠 관리자)일 때만 동작합니다.

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID=1abc...folderId
```

OAuth가 연결돼 있으면 OAuth가 우선입니다.

## 3. RAG Q&A (Google Gemini)

```env
GEMINI_API_KEY=your-gemini-api-key
GEMINI_CHAT_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSION=1536
```

API 키: [Google AI Studio](https://aistudio.google.com/apikey)

- PDF 업로드 시 `document_chunks`에 Gemini embedding 저장
- Q&A: SQL 구조화 질의 + vector 검색 + Gemini 답변
- API 키 없으면 키워드 fallback

## 4. pgvector 확인

Supabase Dashboard → Database → Extensions → `vector` 활성화

`match_document_chunks` RPC 함수가 002 migration에 포함되어 있습니다.

## 5. 동작 모드

| 설정 | 동작 |
|------|------|
| env 없음 | 시드 데이터 데모 모드 |
| Supabase만 | DB 영구 저장 |
| + Gemini | RAG Q&A |
| + Google Drive | 원본 Drive 저장 |

## 6. 사업장관리(랩 포트폴리오) Supabase 저장

로컬 `.data/lab-portfolio.json` 은 git/Vercel에 포함되지 않습니다.  
Vercel과 로컬이 같은 데이터를 쓰려면 `lab_funds` 테이블이 필요합니다.

1. SQL Editor에서 `supabase/migrations/003_lab_portfolio.sql` 실행
2. 로컬 데이터 이관:

```bash
node --env-file=.env.local scripts/migrate-lab-portfolio.cjs
```

또는 관리자 로그인 후:

```bash
curl -X POST http://localhost:3000/api/admin/lab-funds/migrate
```

## 7. 공정율 (기성보고서)

1. SQL Editor에서 `004_lab_progress.sql`, `005_product_review_progress_history.sql` 실행
2. 업로드 → 문서 유형 **공정율** (또는 자동 인식)으로 기성보고서 PDF 업로드
3. **관리자 → 공정율 현황** (`/admin/progress`)에서 조회 · 「수정」으로 편집
4. **검토 대기함** (`/admin/review`)에서 매칭·등록 대기 건 처리

확인일(`confirmed_date`)별로 이력이 쌓입니다. 랩당 최신값은 공정율 현황에 표시됩니다.
더 오래된 확인일 자료를 올리면 업로드 화면에서 덮어쓰기 여부를 묻습니다.

## 8. 상품 마스터 (Supabase)

`005` migration의 `product_master` 테이블에 `/admin` 상품/사업장 등록이 영구 저장됩니다.
Supabase 연결 시 최초 1회 포트폴리오에서 시드 후 DB를 사용합니다.
