# Phase 3 설정 가이드

## 1. Supabase

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. SQL Editor에서 순서대로 실행:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_phase3.sql`
3. `.env.local` 설정:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

4. `npm run dev` 재시작 → Supabase 모드 자동 활성화

## 2. Google Drive

1. Google Cloud Console → Drive API 활성화
2. 서비스 계정 생성 + JSON 키 다운로드
3. Drive에서 `DumpitRE` 폴더 생성 → 서비스 계정 이메일에 **편집자** 공유
4. `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_ROOT_FOLDER_ID=1abc...folderId
```

업로드 시 `{사업장명}/02_공정율/` 하위에 저장됩니다.

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
