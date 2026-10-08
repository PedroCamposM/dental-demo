#!/usr/bin/env bash
# Ejecuta un archivo SQL en el proyecto remoto con la API de gestión de Supabase.
# Uso: SUPABASE_ACCESS_TOKEN=... scripts/consulta-remota.sh archivo.sql
# Sale con error si la consulta falla (p. ej. una verificación que lanza excepción).
set -euo pipefail
PROJECT_REF="${PROJECT_REF:-elotisuupmqmcedjgxiz}"
respuesta="$(jq -Rs '{query: .}' "$1" | curl -sS -X POST \
  "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:?falta SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" --data-binary @-)"
echo "$respuesta"
if echo "$respuesta" | jq -e 'type == "object" and has("message")' > /dev/null; then
  exit 1
fi
