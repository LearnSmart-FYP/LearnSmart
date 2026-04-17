#!/bin/bash
# Script to start services and check database

echo "================================================"
echo "Starting Services and Checking Database"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if Docker is running
echo "Step 1: Checking Docker daemon..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running${NC}"
    echo ""
    echo "Please start Docker Desktop:"
    echo "  1. Open 'Docker Desktop' app from Applications"
    echo "  2. Wait for Docker to fully start (icon in menu bar should be steady)"
    echo "  3. Run this script again"
    echo ""
    exit 1
fi
echo -e "${GREEN}Docker is running${NC}"
echo ""

# Step 2: Start PostgreSQL container
echo "Step 2: Starting PostgreSQL container..."
cd /Users/itst/Documents/SE_Group10_FYP
docker compose up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U admin > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""
echo ""

# Step 3: Check if asset tables exist
echo "Step 3: Checking if asset tables exist..."
TABLES=$(docker compose exec -T postgres psql -U admin -d learning_platform -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'asset%';")
TABLE_COUNT=$(echo $TABLES | tr -d ' ')

if [ "$TABLE_COUNT" -eq "0" ]; then
    echo -e "${YELLOW}No asset tables found${NC}"
    echo ""
    echo "Running migration to create tables..."
    docker compose exec -T postgres psql -U admin -d learning_platform < backend/database/migrations/20260210_add_asset_tables.sql
    echo -e "${GREEN}Tables created${NC}"
else
    echo -e "${GREEN}Found $TABLE_COUNT asset tables${NC}"
fi
echo ""

# Step 4: List all asset tables
echo "Step 4: Asset Tables in Database:"
echo "================================================"
docker compose exec -T postgres psql -U admin -d learning_platform -c "\dt asset*"
echo ""

# Step 5: Show table structure for asset_library
echo "Step 5: asset_library Table Structure:"
echo "================================================"
docker compose exec -T postgres psql -U admin -d learning_platform -c "\d asset_library"
echo ""

# Step 6: Count records
echo "Step 6: Record Counts:"
echo "================================================"
docker compose exec -T postgres psql -U admin -d learning_platform -c "
SELECT 
    'asset_library' as table_name, 
    COUNT(*) as record_count 
FROM asset_library
UNION ALL
SELECT 
    'asset_downloads' as table_name, 
    COUNT(*) as record_count 
FROM asset_downloads
UNION ALL
SELECT 
    'categories' as table_name, 
    COUNT(*) as record_count 
FROM categories
UNION ALL
SELECT 
    'label' as table_name, 
    COUNT(*) as record_count 
FROM label;
"
echo ""

# Step 7: Show sample data
echo "Step 7: Sample Data from asset_library (first 3 rows):"
echo "================================================"
docker compose exec -T postgres psql -U admin -d learning_platform -c "
SELECT 
    id,
    external_id,
    name,
    source,
    asset_type,
    created_at
FROM asset_library 
ORDER BY created_at DESC
LIMIT 3;
"
echo ""

# Step 8: Check if any data exists
RECORD_COUNT=$(docker compose exec -T postgres psql -U admin -d learning_platform -t -c "SELECT COUNT(*) FROM asset_library;")
RECORDS=$(echo $RECORD_COUNT | tr -d ' ')

if [ "$RECORDS" -eq "0" ]; then
    echo -e "${YELLOW}No data found in asset_library${NC}"
    echo ""
    echo "The table exists but is empty. You need to:"
    echo "  1. Check if init_polyhaven.sql was executed"
    echo "  2. Or manually insert sample data"
    echo ""
    echo "To check init scripts:"
    echo "  docker compose exec postgres ls -lh /docker-entrypoint-initdb.d/"
else
    echo -e "${GREEN}Database has $RECORDS asset records${NC}"
fi
echo ""

echo "================================================"
echo "Database Check Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Start backend: cd backend && .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "  2. Test API: curl http://localhost:8000/api/models?page=1&page_size=5"
echo "  3. Open in browser: http://localhost:8000/docs"
echo ""
