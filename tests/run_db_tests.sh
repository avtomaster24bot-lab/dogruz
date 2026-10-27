#!/usr/bin/env bash
# Локальная проверка supabase/vz_schema.sql на чистом PostgreSQL (без Supabase). Схема применяется дважды (идемпотентность).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=vz_test
sudo -u postgres dropdb --if-exists $DB; sudo -u postgres createdb $DB
for f in tests/local_shim.sql supabase/vz_schema.sql supabase/vz_schema.sql tests/db_test.sql; do
  cp "$f" /tmp/vz_$(basename "$f"); sudo -u postgres psql -q -t -A -v ON_ERROR_STOP=1 -d $DB -f /tmp/vz_$(basename "$f") 2>&1 | grep -v "^$" || true
done
