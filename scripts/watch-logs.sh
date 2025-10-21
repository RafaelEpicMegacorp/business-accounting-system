#!/bin/bash

# Simple Real-Time Log Viewer for Railway
# Usage: ./scripts/watch-logs.sh

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         Railway Logs - Real-Time Viewer                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🔍 Watching Railway logs for: business-accounting-system"
echo "📋 All logs will appear below in real-time"
echo ""
echo "⏹️  Press Ctrl+C to stop"
echo "───────────────────────────────────────────────────────────────"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found!"
    echo ""
    echo "📦 Install with:"
    echo "   npm install -g @railway/cli"
    echo "   OR"
    echo "   brew install railway"
    echo ""
    echo "🔑 Then login:"
    echo "   railway login"
    echo ""
    exit 1
fi

# Start tailing logs
railway logs --service business-accounting-system
