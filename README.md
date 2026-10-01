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
- anon(publishable) key는 클라이언트에 노출돼도 안전하도록 설계된 키입니다 (실제 접근 제어는 아래 RLS 정책이 담당). **앱 코드에서는 service role key를 전혀 쓰지 않습니다** (E2E 테스트 데이터 정리에만 선택적으로 쓰이며, Node 쪽에서만 읽고 브라우저 번들에는 들어가지 않습니다).

### 2. Supabase 프로젝트 준비

1. [supabase.com/dashboard](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. **SQL Editor**에서 `supabase/migrations/` 의 SQL 을 **번호 순서대로 모두** 실행
   (`0001_init.sql` 부터 최신 번호까지 — 하나라도 건너뛰면 저장이 실패합니다)
3. **Authentication → Sign In / Providers**에서 **Anonymous Sign-Ins** 활성화
4. (선택) **Authentication → Rate Limits**에서 익명 로그인 제한을 트래픽 규모에 맞게 조정 — 기본값은 부하 테스트나 많은 인원이 짧은 시간에 몰릴 때 막힐 수 있을 만큼 낮습니다.

### 3. 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속.

## 테스트

| 명령어 | 하는 일 |
| --- | --- |
| `npm run test` | 기본 테스트 — 단위 테스트(Vitest) |
| `npm run test:unit` | 단위 테스트만 |
| `npm run test:e2e` | E2E(Playwright) headless 실행 |
| `npm run test:e2e:ui` | Playwright UI 모드 (단계별로 되감아 보기) |
| `npm run test:e2e:headed` | 실제 브라우저 창을 보면서 실행 |
| `npm run test:all` | 타입 검사 → 린트 → 단위 테스트 → 빌드 → E2E |
| `npm run typecheck` | `tsc --noEmit` |

### 단위 테스트

데이터베이스도 브라우저도 필요 없습니다. 순수 계산 로직만 검증합니다.

```bash
npm run test:unit
```

- `src/lib/trip/consensus.test.ts` — 날짜별 가능·미정·불가 집계, 연속 날짜 후보 계산,
  날짜별 충돌 인원, 취향 평균·충돌 판정, 한 줄 요약, **자유 입력(꼭 반영할 점)이 자동 점수에서 제외되는지**
- `src/lib/trip/stay.test.ts` — 전체/객실 예약안 계산(객실 수·총 수용 인원·총액·1인당),
  수용 인원 부족 판정, 동점 투표와 미투표자 처리
- `src/lib/trip/format.test.ts` · `calendar.test.ts` — 금액·기간 표기, 달력 격자
- `src/lib/validation/trip.test.ts` · `accommodation.test.ts` — 후보 기간 60일 상한, 예약안 입력 규칙
- `src/lib/trip/reopen.test.ts` — 조율 재개 배너·라벨
- `src/lib/server/link-preview.test.ts` — og 태그 파싱

### E2E 테스트

핵심 사용자 흐름 전체를 주최자·참여자 A·참여자 B 세 개의 독립 브라우저 세션으로 검증합니다.

| 파일 | 검증하는 흐름 |
| --- | --- |
| `e2e/scenario-a-consensus.spec.ts` | 여행 생성 → 초대 → 세 사람 응답 → 저장 후 그룹 합의 자동 이동 → 임시 합의 표시 → Realtime 갱신 → 주최자 확정 |
| `e2e/scenario-b-stay.spec.ts` | 숙소 전체/객실 예약안 등록과 계산, 수용 인원 부족 차단, 투표와 Realtime 결과 공개, 참여자 권한, 최종 확정 |
| `e2e/scenario-c-reopen.spec.ts` | 확정 이후 `숙소 투표만` / `날짜·취향부터` 재개, 데이터 보존, 다른 브라우저 실시간 반영 |
| `e2e/scenario-d-errors.spec.ts` | 잘못된 초대 링크, 없는 여행, 닉네임 중복, 저장 실패, 주최자 전용 RPC 직접 호출, 나가기·삭제, 새로고침·뒤로가기 |

#### 1. 테스트용 Supabase 준비

**운영 Supabase 는 자동 테스트 대상으로 쓸 수 없습니다.** 설정이 운영 주소를 가리키면
테스트가 시작 전에 멈춥니다. 아래 중 하나를 준비하세요.

**① 로컬 Supabase (권장)** — Docker Desktop 실행 필요

```bash
npm i -D supabase
npx supabase init          # supabase/config.toml 이 없을 때만
npx supabase start         # API URL 과 anon / service_role key 를 출력합니다
npx supabase db reset      # supabase/migrations/*.sql 을 번호 순으로 적용
npx supabase status        # 키를 다시 보고 싶을 때
```

`supabase/config.toml` 은 저장소에 포함되어 있고, TRIPTUNE 에 필요한 두 값이
기본값과 다르게 설정돼 있습니다. `init` 이 이 파일을 새로 만들었다면 확인하세요.

```toml
[auth]
enable_anonymous_sign_ins = true   # 기본값은 false — 끄면 참여 자체가 안 됩니다

[auth.rate_limit]
anonymous_users = 1000             # 기본값 30 — E2E 한 회차가 30명 가까이 만듭니다
```

바꾼 뒤에는 `npx supabase stop && npx supabase start` 로 다시 띄워야 적용됩니다.

**② 테스트 전용 Supabase 프로젝트** — 운영과 별개로 새 프로젝트를 만들고,
`supabase/migrations/` 의 SQL 을 번호 순으로 SQL Editor 에서 실행한 뒤
**Authentication → Sign In / Providers → Anonymous Sign-Ins** 를 켭니다.
이 경우 `E2E_ALLOW_REMOTE_SUPABASE=1` 을 함께 설정해야 합니다.

#### 2. 환경 변수

`.env.example` 의 `E2E_*` 항목을 보고 저장소 루트에 `.env.test` 를 만듭니다
(`.env.test` 는 `.gitignore` 에 걸려 커밋되지 않습니다).

```bash
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_ANON_KEY=sb_publishable_...
# 정리용(선택). Node 쪽에서만 쓰이고 브라우저·리포트에는 절대 나가지 않습니다.
E2E_SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

> 키는 `npx supabase status` 출력의 **🔑 Authentication Keys** 표에서 가져옵니다
> (`Publishable` → ANON_KEY, `Secret` → SERVICE_ROLE_KEY).
> 바로 아래 **📦 Storage (S3)** 의 Access Key / Secret Key 와 헷갈리기 쉬운데,
> 그걸 넣으면 초대 화면이 "초대 링크를 찾을 수 없어요."로 떨어집니다.
> CLI 버전에 따라 `sb_publishable_…` 대신 `eyJ…`(JWT)로 나오기도 합니다 — 표 이름으로 고르세요.

필수 변수가 없으면 런타임 오류 대신 **빠진 변수 이름과 설정 방법**을 출력하고 중단합니다.

테스트 시작 전에 테스트용 Supabase 상태도 함께 확인합니다 — 서버 연결, 키 유효성,
익명 로그인 활성화, 마이그레이션 적용 여부. 문제가 있으면 브라우저를 띄우지 않고
**무엇을 어떻게 고쳐야 하는지** 알려주며 멈춥니다.

#### 3. 실행

```bash
npx playwright install chromium   # 최초 1회
npm run test:e2e
```

앱은 테스트가 직접 프로덕션 빌드해서 `http://127.0.0.1:3100` 에 띄웁니다
(`next dev` 의 첫 진입 컴파일 지연 때문에 테스트가 흔들리는 것을 막기 위해서입니다).
개발 서버 포트(3000)와 겹치지 않으므로 `npm run dev` 를 켜둔 채로도 돌릴 수 있습니다.

#### 4. 테스트 데이터

- 이 실행이 만든 여행에는 `[E2E-<실행ID>] 제주도` 처럼 **실행마다 다른 접두사**가 붙습니다.
- 끝나면 그 접두사로 시작하는 여행만 지웁니다 (`e2e/support/cleanup.ts`).
  테이블을 비우거나 접두사 없는 데이터를 건드리는 코드는 없습니다.
- `E2E_SUPABASE_SERVICE_ROLE_KEY` 가 없으면 정리를 건너뛰고, 남은 접두사를 콘솔에 알려줍니다.
- 각 테스트는 스스로 필요한 상태를 만들며 실행 순서에 의존하지 않습니다.

#### 5. 실패했을 때

```
playwright-report/     # npx playwright show-report
test-results/          # 실패한 테스트의 screenshot · video · trace.zip
npx playwright show-trace test-results/<...>/trace.zip
```

trace 는 실패한 테스트에서만, video 와 screenshot 도 실패 시에만 남습니다.

### GitHub Actions

`.github/workflows/ci.yml` 이 push 와 pull request 마다 돕니다.

1. 의존성 설치 → 2. 타입 검사 → 3. 린트 → 4. 단위 테스트 → 5. 프로덕션 빌드
   (여기까지는 Supabase 없이 언제나 실행됩니다)
6. Playwright 브라우저 설치 → 7. 핵심 E2E → 8. 실패 시 리포트·trace 업로드
   (**아래 시크릿이 등록된 저장소에서만** 실행되고, 없으면 조용히 건너뜁니다)

필요한 GitHub Secrets (Settings → Secrets and variables → Actions):

| Secret | 필수 | 설명 |
| --- | --- | --- |
| `E2E_SUPABASE_URL` | ✅ | 테스트 전용 Supabase 주소. **운영 주소를 넣지 마세요.** |
| `E2E_SUPABASE_ANON_KEY` | ✅ | 테스트용 anon(publishable) 키 |
| `E2E_ALLOW_REMOTE_SUPABASE` | 원격 사용 시 | 값 `1`. 로컬이 아닌 테스트 프로젝트를 쓴다는 명시적 확인 |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` | 선택 | 실행 후 테스트 데이터 정리용 |

### SQL 테스트

`reopen_after_confirm` 등 서버 함수의 권한·상태 전이는 Postgres 를 직접 띄워 검증합니다.

```bash
supabase/tests/run.sh     # PGPORT 환경변수로 접속 포트 지정
```

## Vercel 배포

1. GitHub 저장소로 푸시
2. [vercel.com/new](https://vercel.com/new)에서 저장소 Import (Next.js 프레임워크 자동 인식, 빌드 커맨드 변경 불필요)
3. **Environment Variables**에 아래 두 값 추가 (Production/Preview 모두)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

배포 후 별도 설정은 필요 없습니다 — 데이터베이스 스키마는 Supabase 쪽에서 이미 완결된 상태이고, 앱은 요청 도메인을 기준으로 동작합니다 (하드코딩된 URL 없음).

### 배포 전 체크리스트

- [ ] `supabase/migrations/` 의 모든 마이그레이션이 프로덕션 Supabase 프로젝트에 실행되어 있는지 확인
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
supabase/migrations/        SQL 마이그레이션 (번호 순으로 실행)
supabase/tests/             서버 함수(권한·상태 전이) SQL 테스트
e2e/
  ├─ scenario-*.spec.ts       핵심 사용자 흐름 E2E
  ├─ support/                 액터·플로우·환경변수·정리 유틸
  └─ global-setup/teardown    환경 검증 · 실행별 데이터 정리
.github/workflows/ci.yml    타입·린트·단위·빌드 (+조건부 E2E)
```
