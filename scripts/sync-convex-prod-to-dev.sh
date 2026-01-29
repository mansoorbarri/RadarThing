#!/bin/bash

# One-time script to sync Convex PRODUCTION data to DEVELOPMENT
# Direction: PROD → DEV (clears dev first, then imports prod data)
# Usage: ./scripts/sync-convex-prod-to-dev.sh

set -e

BACKUP_DIR="./convex-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="$BACKUP_DIR/prod-export-$TIMESTAMP.zip"

echo "==========================================="
echo "  Convex Sync: PRODUCTION → DEVELOPMENT"
echo "==========================================="
echo ""
echo "This script will:"
echo "  1. Export all data from PRODUCTION"
echo "  2. DELETE all data in DEVELOPMENT"
echo "  3. Import production data into DEVELOPMENT"
echo ""
echo "WARNING: All development data will be permanently deleted!"
echo ""
read -p "Are you sure you want to continue? (yes/N) " -r
echo ""

if [[ ! $REPLY == "yes" ]]; then
    echo "Aborted. Type 'yes' to confirm."
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Step 1: Export from production
echo "[1/2] Exporting data from PRODUCTION..."
npx convex export --prod --path "$EXPORT_FILE"
echo "✓ Exported to: $EXPORT_FILE"
echo ""

# Step 2: Clear dev and import (--replace-all deletes all existing data first)
echo "[2/2] Clearing DEVELOPMENT and importing PRODUCTION data..."
npx convex import --replace-all "$EXPORT_FILE"
echo ""
echo "==========================================="
echo "  Sync complete!"
echo "==========================================="
echo ""
echo "PRODUCTION data has been copied to DEVELOPMENT."
echo "Backup saved at: $EXPORT_FILE"
