#!/usr/bin/env bash
# Valida as migrações e as regras de servidor em um Postgres local.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists launchos_test" -c "create database launchos_test"
for f in supabase/tests/supabase_stubs.sql supabase/migrations/*.sql; do $P -d launchos_test -f "$f" 2>&1 | grep -v -e wal_level -e HINT || true; done
$P -t -d launchos_test -f supabase/tests/behavior.sql 2>&1 | sed 's/^psql:[^ ]* //' | grep -E 'NOTICE|ERROR|FALHOU|TODOS'
