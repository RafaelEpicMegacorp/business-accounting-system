#!/bin/bash

# Test script for manual Wise sync endpoint

echo "=== Testing Manual Wise Sync Endpoint ==="
echo ""

# Get auth token
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:7393/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"rafael\", \"password\": \"asdflkj@3!\"}" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  exit 1
fi

echo "✓ Got auth token"
echo ""

# Trigger manual sync
echo "2. Triggering manual sync (this may take 30-60 seconds)..."
RESPONSE=$(curl -s -X POST http://localhost:7393/api/wise/sync/manual \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --max-time 120)

echo ""
echo "3. Sync Response:"
echo "$RESPONSE" | jq .
echo ""

# Check metadata
echo "4. Checking sync metadata..."
psql -U accounting_user -d accounting_db -c "SELECT key, LEFT(value, 60) as value, updated_at FROM wise_sync_metadata ORDER BY key;"
echo ""

echo "=== Test Complete ==="
