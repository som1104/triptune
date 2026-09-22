#!/usr/bin/env bash
# 임시 Postgres 에 뼈대 스키마 + 마이그레이션 + 시나리오를 올려 재개 로직을 검증한다.
set -euo pipefail
PSQL=(psql -h "${PGHOST:-/tmp}" -p "${PGPORT:-5433}" -U "${PGUSER:-postgres}" -v ON_ERROR_STOP=1 -q)
DIR="$(cd "$(dirname "$0")" && pwd)"

"${PSQL[@]}" -c "drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;" >/dev/null 2>&1
"${PSQL[@]}" -f "$DIR/reopen_after_confirm.test.sql" >/dev/null 2>&1
"${PSQL[@]}" -f "$DIR/../migrations/0008_reopen_after_confirm.sql" 2>&1 | grep -v "^NOTICE|^DETAIL|^drop cascades" || true
"${PSQL[@]}" -f "$DIR/cases.sql"
