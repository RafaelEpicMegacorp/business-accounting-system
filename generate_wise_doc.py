#!/usr/bin/env python3
"""
Generate Wise API Changes Documentation PDF
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from datetime import datetime

# Create PDF
pdf_file = "WISE_API_CHANGES.pdf"
doc = SimpleDocTemplate(pdf_file, pagesize=letter,
                        rightMargin=0.75*inch, leftMargin=0.75*inch,
                        topMargin=0.75*inch, bottomMargin=0.75*inch)

# Container for the 'Flowable' objects
elements = []

# Define styles
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CodeBlock',
                         fontName='Courier',
                         fontSize=8,
                         leftIndent=20,
                         rightIndent=20,
                         backColor=colors.lightgrey,
                         spaceBefore=6,
                         spaceAfter=6))
styles.add(ParagraphStyle(name='SectionHeading',
                         fontSize=16,
                         textColor=colors.HexColor('#2563eb'),
                         spaceAfter=12,
                         spaceBefore=12,
                         fontName='Helvetica-Bold'))
styles.add(ParagraphStyle(name='SubHeading',
                         fontSize=12,
                         textColor=colors.HexColor('#1e40af'),
                         spaceAfter=8,
                         spaceBefore=8,
                         fontName='Helvetica-Bold'))

# Title
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=24,
    textColor=colors.HexColor('#1e3a8a'),
    spaceAfter=30,
    alignment=TA_CENTER,
    fontName='Helvetica-Bold'
)
elements.append(Paragraph("Wise Integration", title_style))
elements.append(Paragraph("Architecture Changes & Issue Resolution", title_style))
elements.append(Spacer(1, 0.2*inch))

# Date
date_text = f"<i>Generated: {datetime.now().strftime('%B %d, %Y at %H:%M')}</i>"
elements.append(Paragraph(date_text, styles['Normal']))
elements.append(Spacer(1, 0.3*inch))

# Executive Summary
elements.append(Paragraph("Executive Summary", styles['SectionHeading']))
elements.append(Paragraph(
    "Removed full Wise API integration in favor of manual CSV upload. Encountered database connection pool "
    "exhaustion issues during CSV import implementation. Resolved through proper pool configuration.",
    styles['Normal']
))
elements.append(Spacer(1, 0.2*inch))

# Section 1: Initial Architecture
elements.append(PageBreak())
elements.append(Paragraph("1. Initial Architecture (Before Changes)", styles['SectionHeading']))

elements.append(Paragraph("Wise API Integration Components", styles['SubHeading']))
elements.append(Paragraph("<b>Backend (8 files removed):</b>", styles['Normal']))

backend_files = [
    "backend/src/services/wiseService.js - Wise API client wrapper",
    "backend/src/controllers/wiseWebhookController.js - Webhook event processing",
    "backend/src/routes/wiseRoutes.js - API sync endpoints",
    "backend/src/routes/wiseDebug.js - Debug/diagnostic routes",
    "backend/src/utils/wiseScaSigner.js - SCA (Strong Customer Authentication) signing",
    "backend/src/utils/wiseSignatureValidator.js - Webhook signature verification",
    "backend/src/webhookMonitor.js - In-memory webhook monitoring",
    "backend/src/routes/webhookMonitor.js - Monitor UI routes"
]
for file in backend_files:
    elements.append(Paragraph(f"• {file}", styles['Normal']))

elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("<b>Scripts (5 files removed):</b>", styles['Normal']))
script_files = [
    "scripts/test-wise-sca.js",
    "scripts/create-wise-webhook.js",
    "scripts/monitor-wise-webhooks.js",
    "scripts/test-webhook-call.js",
    "scripts/test-webhook-no-sig.js"
]
for file in script_files:
    elements.append(Paragraph(f"• {file}", styles['Normal']))

elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("<b>Frontend (1 component removed):</b>", styles['Normal']))
elements.append(Paragraph("• frontend/src/components/WiseReviewQueue.jsx - Transaction review UI", styles['Normal']))
elements.append(Paragraph("• Removed 'Wise Sync' tab from AccountingApp.jsx", styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("Features Removed", styles['SubHeading']))
features = [
    "Real-time transaction sync via Wise API",
    "Webhook-based balance updates",
    "SCA authentication flow",
    "Transaction review and classification queue",
    "Automated sync scheduling"
]
for feature in features:
    elements.append(Paragraph(f"• {feature}", styles['Normal']))

# Section 2: New Architecture
elements.append(PageBreak())
elements.append(Paragraph("2. New Architecture (Current State)", styles['SectionHeading']))

elements.append(Paragraph("Components Retained", styles['SubHeading']))
elements.append(Paragraph("<b>Backend (3 files kept):</b>", styles['Normal']))
kept_files = [
    "backend/src/routes/wiseImport.js - CSV upload endpoint (POST /api/wise/import)",
    "backend/src/services/wiseClassifier.js - Transaction category mapping",
    "backend/src/models/wiseTransactionModel.js - Database model"
]
for file in kept_files:
    elements.append(Paragraph(f"• {file}", styles['Normal']))

elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("<b>Frontend (1 new component):</b>", styles['Normal']))
elements.append(Paragraph("• frontend/src/components/WiseImport.jsx - CSV upload modal (276 lines)", styles['Normal']))
elements.append(Paragraph("• 'Import CSV' button added to Dashboard", styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("Current Workflow", styles['SubHeading']))
workflow = [
    "1. User exports CSV from Wise.com (Account → Statements → Export CSV)",
    "2. User uploads CSV via dashboard modal",
    "3. Backend parses 21-column Wise CSV format",
    "4. Automatic transaction classification (income/expense)",
    "5. Duplicate prevention by Wise transaction ID",
    "6. Bulk insert with database transaction",
    "7. Balance auto-update after import"
]
for step in workflow:
    elements.append(Paragraph(step, styles['Normal']))

# Section 3: Issues Encountered
elements.append(PageBreak())
elements.append(Paragraph("3. Issues Encountered & Resolution", styles['SectionHeading']))

elements.append(Paragraph("Issue #1: CSV Import Returning 500 Error", styles['SubHeading']))
elements.append(Paragraph("<b>Symptom:</b>", styles['Normal']))
code1 = """POST /api/wise/import → 500 Internal Server Error
{error: 'Database connection failed', details: 'Unable to connect to database...'}"""
elements.append(Preformatted(code1, styles['CodeBlock']))

elements.append(Paragraph("<b>Investigation Steps:</b>", styles['Normal']))
inv_steps = [
    "✅ Verified backend code correct",
    "✅ Verified frontend code correct",
    "✅ Verified database accessible (dashboard working)",
    "❌ CSV import specifically failing"
]
for step in inv_steps:
    elements.append(Paragraph(step, styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("Issue #2: Variable Naming Inconsistency", styles['SubHeading']))
elements.append(Paragraph("<b>Problem:</b>", styles['Normal']))
code2 = """// wiseImport.js (WRONG)
const db = require('../config/database');
client = await db.pool.getClient(); // db.pool is undefined!

// Other files use (CORRECT)
const pool = require('../config/database');
client = await pool.getClient();"""
elements.append(Preformatted(code2, styles['CodeBlock']))
elements.append(Paragraph("<b>Fix:</b> Changed wiseImport.js to use 'pool' naming convention (commit: 8636c6d)", styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("Issue #3: Connection Pool Exhaustion (ROOT CAUSE)", styles['SubHeading']))
elements.append(Paragraph("<b>Problem:</b>", styles['Normal']))
problems = [
    "• Database pool had NO configuration (using pg defaults)",
    "• Default: max 10 connections, no timeouts",
    "• Dashboard uses pool.query() → grab connection, use immediately, auto-release",
    "• CSV import uses pool.getClient() → hold connection for entire transaction",
    "• Pool exhausted → getClient() fails → 500 error"
]
for p in problems:
    elements.append(Paragraph(p, styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("<b>Evidence:</b>", styles['Normal']))
evidence = [
    "• Dashboard works fine (simple queries)",
    "• CSV import fails (long-running transactions)",
    "• Error: 'Database connection failed'"
]
for e in evidence:
    elements.append(Paragraph(e, styles['Normal']))

# Section 4: Solution
elements.append(PageBreak())
elements.append(Paragraph("4. Solution Implemented", styles['SectionHeading']))

elements.append(Paragraph("Root Cause:", styles['SubHeading']))
code3 = """// database.js (BEFORE - NO POOL CONFIG)
const pool = new Pool(poolConfig);"""
elements.append(Preformatted(code3, styles['CodeBlock']))

elements.append(Paragraph("Solution:", styles['SubHeading']))
code4 = """// database.js (AFTER - WITH POOL CONFIG)
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,                     // Limit to 5 connections (Railway free tier)
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast after 10s
  allowExitOnIdle: false      // Keep pool alive
};"""
elements.append(Preformatted(code4, styles['CodeBlock']))

elements.append(Paragraph("<b>Fix commits:</b>", styles['Normal']))
commits = [
    "• be8a265 - Added connection pool configuration",
    "• 1a52b57 - Added diagnostic endpoint (GET /api/wise/test-connection)",
    "• 35413cc - Improved error handling and CSV validation"
]
for c in commits:
    elements.append(Paragraph(c, styles['Normal']))

# Section 5: Technical Improvements
elements.append(PageBreak())
elements.append(Paragraph("5. Technical Improvements Made", styles['SectionHeading']))

elements.append(Paragraph("Enhanced Error Handling", styles['SubHeading']))
improvements = [
    "• Check 21-column format",
    "• Validate required columns (ID, Status, Direction)",
    "• Row-by-row field count verification",
    "• Clear error messages with troubleshooting tips"
]
for i in improvements:
    elements.append(Paragraph(i, styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("Comprehensive Logging", styles['SubHeading']))
code5 = """console.log('=== CSV Import Started ===');
console.log('User:', req.user?.id, req.user?.username);
console.log('File:', req.file?.originalname, req.file?.size, 'bytes');
console.log('Total lines (including header):', lines.length);
console.log('CSV Headers found:', headerFields.length, 'columns');
// ... detailed logging throughout process"""
elements.append(Preformatted(code5, styles['CodeBlock']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("Diagnostic Endpoint", styles['SubHeading']))
elements.append(Paragraph("GET /api/wise/test-connection", styles['Normal']))
diag_tests = [
    "• Tests pool.query() - simple queries",
    "• Tests pool.getClient() - dedicated connection",
    "• Returns pool statistics (totalCount, idleCount, waitingCount)"
]
for d in diag_tests:
    elements.append(Paragraph(d, styles['Normal']))

# Section 6: Deployment Details
elements.append(PageBreak())
elements.append(Paragraph("6. Deployment Details", styles['SectionHeading']))

elements.append(Paragraph("<b>Environment:</b>", styles['Normal']))
deployment = [
    "• <b>Backend:</b> Railway (https://business-accounting-system-production.up.railway.app)",
    "• <b>Frontend:</b> Netlify (https://ds-accounting.netlify.app)",
    "• <b>Database:</b> Railway PostgreSQL"
]
for d in deployment:
    elements.append(Paragraph(d, styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("<b>Key Configuration:</b>", styles['Normal']))
code6 = """# Backend .env (Railway)
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=3001

# Frontend .env (Netlify)
VITE_API_URL=https://business-accounting-system-production.up.railway.app/api"""
elements.append(Preformatted(code6, styles['CodeBlock']))

# Section 7: Lessons Learned
elements.append(PageBreak())
elements.append(Paragraph("7. Lessons Learned", styles['SectionHeading']))

lessons = [
    ("<b>1. Connection Pool Configuration is Critical</b>", [
        "Never rely on defaults for production databases",
        "Always set max connections, timeouts, and idle timeouts",
        "Monitor pool statistics during development"
    ]),
    ("<b>2. Naming Conventions Matter</b>", [
        "Code imported database module as both 'db' and 'pool'",
        "Inconsistency caused db.pool.getClient() to fail",
        "Standardized on 'pool' convention"
    ]),
    ("<b>3. Different Query Patterns, Different Behavior</b>", [
        "pool.query() - auto-manages connections (works with defaults)",
        "pool.getClient() - manual connection management (needs proper pool config)"
    ]),
    ("<b>4. Testing in Production Reveals Issues</b>", [
        "CSV import was never tested end-to-end before deployment",
        "Error messages were too generic initially",
        "Added diagnostic endpoint for future troubleshooting"
    ])
]

for title, points in lessons:
    elements.append(Paragraph(title, styles['Normal']))
    elements.append(Spacer(1, 0.05*inch))
    for point in points:
        elements.append(Paragraph(f"   • {point}", styles['Normal']))
    elements.append(Spacer(1, 0.1*inch))

# Section 8: Files Modified
elements.append(PageBreak())
elements.append(Paragraph("8. Files Modified (Final State)", styles['SectionHeading']))

elements.append(Paragraph("<b>Modified:</b>", styles['Normal']))
modified = [
    "backend/src/config/database.js - Added pool configuration",
    "backend/src/routes/wiseImport.js - Fixed imports, added validation, added diagnostic endpoint",
    "backend/src/server.js - Removed Wise API routes, kept CSV import route",
    "frontend/src/components/DashboardView.jsx - Added CSV import button",
    "frontend/src/components/AccountingApp.jsx - Removed Wise Sync tab"
]
for m in modified:
    elements.append(Paragraph(f"• {m}", styles['Normal']))

elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("<b>Created:</b>", styles['Normal']))
elements.append(Paragraph("• frontend/src/components/WiseImport.jsx - New CSV upload modal", styles['Normal']))

elements.append(Spacer(1, 0.1*inch))
elements.append(Paragraph("<b>Deleted:</b>", styles['Normal']))
elements.append(Paragraph("• 8 backend files (services, controllers, routes, utils)", styles['Normal']))
elements.append(Paragraph("• 5 scripts (testing, monitoring)", styles['Normal']))
elements.append(Paragraph("• 1 frontend component (WiseReviewQueue)", styles['Normal']))

# Section 9: Current Status
elements.append(PageBreak())
elements.append(Paragraph("9. Current Status", styles['SectionHeading']))

elements.append(Paragraph("✅ <b>Working:</b>", styles['Normal']))
working = [
    "CSV manual upload functional",
    "Transaction classification automatic",
    "Duplicate prevention working",
    "Balance updates correct",
    "All Wise API code removed"
]
for w in working:
    elements.append(Paragraph(f"   • {w}", styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("✅ <b>Tested:</b>", styles['Normal']))
tested = [
    "CSV import with 21-column Wise format",
    "Database connection pool under load",
    "Error handling and validation"
]
for t in tested:
    elements.append(Paragraph(f"   • {t}", styles['Normal']))

elements.append(Spacer(1, 0.2*inch))
elements.append(Paragraph("📝 <b>Notes:</b>", styles['Normal']))
notes = [
    "Pool configured for Railway free tier limits (max 5 connections)",
    "Diagnostic endpoint available for troubleshooting",
    "Comprehensive logging added for production debugging"
]
for n in notes:
    elements.append(Paragraph(f"   • {n}", styles['Normal']))

elements.append(Spacer(1, 0.3*inch))
elements.append(Paragraph("<b>Git Commits:</b> 9472b00, 16088d3, 35413cc, 6a9f43b, 8636c6d, 1a52b57, be8a265", styles['Normal']))

# Build PDF
doc.build(elements)
print(f"✅ PDF generated successfully: {pdf_file}")
