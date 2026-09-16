# TRIPTUNE

친구들과 여행 날짜와 취향을 조율하고, 숙소를 투표로 정해 여행을 확정하는 협업 여행 플래너.

가입 없이 초대 링크와 닉네임만으로 참여하고(Supabase Anonymous Auth), 여러 사람이 동시에 같은 여행에 접속해도 실시간으로 반영됩니다.

## 기술 스택

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Anonymous Auth, Realtime, RLS)
- React Hook Form + Zod
- Vitest (단위 테스트) + Playwright (E2E 테스트)

## 로컬 개발

### 1. 환경 변수

`.env.example`을 `.env.local`로 복사하고 본인의 Supabase 프로젝트 값으로 채웁니다.

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 Supabase 대시보드의 **Project Settings → API**에서 확인합니다.
- anon(publishable) key는 클라이언트에 노출돼도 안전하도록 설계된 키입니다 (실제 접근 제어는 아래 RLS 정책이 담당). **service role key는 어디에도 사용하지 않습니다.**

### 2. Supabase 프로젝트 준비

1. [supabase.com/dashboard](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. **SQL Editor**에서 아래 두 마이그레이션을 순서대로 실행
   - `supabase/migrations/0001_init.sql` — 테이블, RLS 정책, 트리거, RPC 함수 전체
   - `supabase/migrations/0002_fix_invite_token.sql` — 초대 토큰 생성 함수 패치
3. **Authentication → Sign In / Providers**에서 **Anonymous Sign-Ins** 활성화
4. (선택) **Authentication → Rate Limits**에서 익명 로그인 제한을 트래픽 규모에 맞게 조정 — 기본값은 부하 테스트나 많은 인원이 짧은 시간에 몰릴 때 막힐 수 있을 만큼 낮습니다.

### 3. 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속.

## 테스트

```bash
npm run test       # 단위 테스트 (Vitest) — 핵심 계산 로직(날짜 합의, 취향 합의/충돌, 그룹 요약)
npm run test:e2e   # E2E 테스트 (Playwright) — 프로덕션 빌드를 직접 빌드+구동해서 실행됩니다
```

`test:e2e`는 실제 Supabase 프로젝트에 트립/참여자 데이터를 생성합니다. 익명 로그인 속도 제한에 걸릴 수 있으니, 반복 실행 시 대시보드에서 제한을 확인하세요.

## Vercel 배포

1. GitHub 저장소로 푸시
2. [vercel.com/new](https://vercel.com/new)에서 저장소 Import (Next.js 프레임워크 자동 인식, 빌드 커맨드 변경 불필요)
3. **Environment Variables**에 아래 두 값 추가 (Production/Preview 모두)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

배포 후 별도 설정은 필요 없습니다 — 데이터베이스 스키마는 Supabase 쪽에서 이미 완결된 상태이고, 앱은 요청 도메인을 기준으로 동작합니다 (하드코딩된 URL 없음).

### 배포 전 체크리스트

- [ ] 위 두 마이그레이션이 프로덕션 Supabase 프로젝트에 실행되어 있는지 확인
- [ ] Anonymous Sign-Ins가 켜져 있는지 확인
- [ ] 익명 로그인 Rate Limit이 예상 트래픽에 맞게 설정되어 있는지 확인
- [ ] `npm run build`가 로컬에서 경고 없이 성공하는지 확인

## 프로젝트 구조

```
src/app/                    라우트 (App Router)
  ├─ page.tsx                여행 생성
  ├─ join/[inviteToken]/     초대 링크 참여
  ├─ trip/[tripId]/
  │   ├─ (tabs)/              홈 · 합의 · 투표 탭 (하단 탭바 공유)
  │   └─ respond/             날짜·취향 입력
  └─ api/link-preview/        숙소 링크 메타데이터 조회 (SSRF 방지)
src/components/ui/          범용 UI 컴포넌트 (Button, Modal, BottomSheet 등)
src/components/trip/        여행 도메인 컴포넌트
src/lib/trip/consensus.ts   날짜·취향 합의 계산 엔진 (순수 함수, 단위 테스트 대상)
src/lib/supabase/           Supabase 클라이언트 (browser/server/proxy) + DB 타입
supabase/migrations/        SQL 마이그레이션
e2e/                         Playwright E2E 테스트
```
