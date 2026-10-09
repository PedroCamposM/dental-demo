#!/usr/bin/env bash
# Aplica supabase/migrations en un Postgres efímero, corre supabase/tests/*.test.sql
# y luego carga supabase/seed.sql y verifica los casos de la demo.
# Requiere los binarios de Postgres 15+ (PGBIN, por defecto /usr/lib/postgresql/16/bin).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
TMP="$(mktemp -d)"
RUN=()
if [ "$(id -u)" = 0 ]; then chown postgres "$TMP"; RUN=(runuser -u postgres --); fi
PORT="${PGPORT_TEST:-54329}"
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust --locale=C.UTF-8 >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

psql_() { "$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql_ -f supabase/tests/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do
  echo "migración: $(basename "$f")"
  psql_ -1 -f "$f"
done
for f in supabase/tests/*.test.sql; do  # _ayudantes.sql se incluye desde cada test
  echo "test: $(basename "$f")"
  psql_ -o /dev/null -f "$f"
done
echo "seed: supabase/seed.sql"
# Como `supabase db reset`: todos los seeds de config.toml en UNA sesión (las
# funciones y tablas pg_temp de un seed siguen existiendo en el siguiente).
cat supabase/seed.sql supabase/seed_etapa1.sql supabase/seed_etapa2.sql supabase/seed_etapa3.sql \
    supabase/seed_etapa4.sql supabase/seed_etapa5.sql | psql_ -o /dev/null
# Idempotentes: cada uno, otra vez y por separado (como se cargan en el remoto).
for f in supabase/seed_etapa1.sql supabase/seed_etapa2.sql supabase/seed_etapa3.sql supabase/seed_etapa4.sql \
         supabase/seed_etapa5.sql; do
  psql_ -o /dev/null -f "$f"
done
psql_ -o /dev/null -f supabase/tests/seed.check.sql
echo "seed: verificaciones OK"
for f in supabase/verificaciones/2*.sql; do
  [ -e "$f" ] || continue
  echo "verificación: $(basename "$f")"
  psql_ -o /dev/null -f "$f"
done

# Migración de datos sobre datos: en otra base, se aplican las migraciones hasta la
# anterior a la última, se carga el seed de esas etapas y recién entonces la última
# migración y su verificación (así el relleno toca filas, como en el remoto).
ULTIMA="$(ls supabase/migrations/*.sql | tail -1)"
echo "migración de datos sobre el seed: $(basename "$ULTIMA")"
psql_ -c "create database datos" >/dev/null
psqld() { "$PGBIN/psql" -h "$TMP" -p "$PORT" -U postgres -d datos -X -q -v ON_ERROR_STOP=1 "$@"; }
psqld -o /dev/null -f supabase/tests/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do
  [ "$f" = "$ULTIMA" ] && continue
  psqld -o /dev/null -1 -f "$f"
done
cat supabase/seed.sql supabase/seed_etapa1.sql supabase/seed_etapa2.sql supabase/seed_etapa3.sql \
    supabase/seed_etapa4.sql | psqld -o /dev/null
psqld -o /dev/null -1 -f "$ULTIMA"
for f in supabase/verificaciones/2*.sql; do psqld -o /dev/null -f "$f"; done
psqld -o /dev/null -f supabase/seed_etapa5.sql
psqld -o /dev/null -f supabase/tests/seed.check.sql
echo "OK"
