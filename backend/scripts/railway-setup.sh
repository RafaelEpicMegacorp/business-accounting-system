#!/bin/bash
# Railway Database Setup Script
# This script initializes the PostgreSQL database on Railway with the complete schema

set -e  # Exit on error

echo "🚀 Railway Database Setup"
echo "=========================="

# Check if required environment variables are set
if [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ] || [ -z "$PGDATABASE" ]; then
    echo "❌ Error: Database environment variables not set"
    echo "Required: PGHOST, PGUSER, PGPASSWORD, PGDATABASE"
    exit 1
fi

echo "📊 Database Configuration:"
echo "  Host: $PGHOST"
echo "  User: $PGUSER"
echo "  Database: $PGDATABASE"
echo ""

# Test database connection
echo "🔍 Testing database connection..."
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Failed to connect to database"
    exit 1
fi

# Run the combined schema
echo ""
echo "📥 Running combined schema migration..."
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f backend/migrations/combined_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema migration completed successfully"
else
    echo "❌ Schema migration failed"
    exit 1
fi

# Verify tables were created
echo ""
echo "🔍 Verifying tables..."
TABLE_COUNT=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "✅ Created $TABLE_COUNT tables"

# Show table summary
echo ""
echo "📋 Table Summary:"
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

echo ""
echo "✅ Railway database setup complete!"
echo ""
echo "Next steps:"
echo "1. Verify the backend service is running"
echo "2. Test the /health endpoint"
echo "3. Update VITE_API_URL in Netlify with Railway URL"
