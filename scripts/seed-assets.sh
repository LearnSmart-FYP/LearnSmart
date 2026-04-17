#!/bin/bash
# Seed the asset_library table with Polyhaven models and HDRI scenes.
# Safe to run multiple times (uses ON CONFLICT DO NOTHING).
# Run from the repo root: bash scripts/seed-assets.sh

set -e

# Load local env to get DB credentials
if [ -f .env ]; then
    export $(grep -E '^POSTGRES_(USER|PASSWORD|DB)' .env | xargs)
fi

POSTGRES_USER=${POSTGRES_USER:-admin}
POSTGRES_DB=${POSTGRES_DB:-learning_platform}
CONTAINER=${1:-fyp-postgres}

echo "==> Checking container '$CONTAINER'..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: Container '$CONTAINER' is not running."
    echo "Usage: bash scripts/seed-assets.sh [container-name]"
    exit 1
fi

echo "==> Current asset_library count:"
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT asset_type, COUNT(*) FROM asset_library GROUP BY asset_type ORDER BY asset_type;"

HDRI_COUNT=$(docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM asset_library WHERE asset_type='hdri';")
MODEL_COUNT=$(docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM asset_library WHERE asset_type='model';")

echo ""
if [ "$MODEL_COUNT" -lt 100 ]; then
    echo "==> Importing init_pg_polyhaven.sql (models + HDRIs)..."
    docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        < backend/database/init_pg_polyhaven.sql
    echo "    Done."
else
    echo "==> Models already present ($MODEL_COUNT rows), skipping polyhaven.sql"
fi

if [ "$HDRI_COUNT" -lt 100 ]; then
    echo "==> HDRIs missing ($HDRI_COUNT rows) — re-running polyhaven.sql to import HDRIs..."
    docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        < backend/database/init_pg_polyhaven.sql
    echo "    Done."
fi

echo "==> Importing init_pg_polyhaven2.sql (textures)..."
docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    < backend/database/init_pg_polyhaven2.sql
echo "    Done."

echo ""
echo "==> Final asset_library count:"
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT asset_type, COUNT(*) FROM asset_library GROUP BY asset_type ORDER BY asset_type;"

echo ""
echo "Done! Models and scenes are now available in the local database."
