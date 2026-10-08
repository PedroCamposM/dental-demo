#!/usr/bin/env bash
# Pruebas de base de datos contra un Supabase local REAL (supabase start):
# reinicia la base (migraciones + seed), verifica el seed y corre los tests SQL.
# Lo usa el CI; en una PC con Docker también funciona.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
psql_() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

npx supabase db reset --local
echo "seed: verificaciones"
psql_ -o /dev/null -f supabase/tests/seed.check.sql
for f in supabase/verificaciones/2*.sql; do
  [ -e "$f" ] || continue
  echo "verificación: $(basename "$f")"
  psql_ -o /dev/null -f "$f"
done
for f in supabase/tests/*.test.sql; do
  echo "test: $(basename "$f")"
  psql_ -o /dev/null -f "$f"
done
echo "OK (Supabase local)"
