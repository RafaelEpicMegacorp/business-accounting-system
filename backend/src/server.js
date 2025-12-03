require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const entryRoutes = require('./routes/entryRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const contractRoutes = require('./routes/contractRoutes');
const projectRoutes = require('./routes/projectRoutes');
const positionRoutes = require('./routes/positionRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const wiseImportRoutes = require('./routes/wiseImport');
const currencyRoutes = require('./routes/currencyRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const wiseTestRoutes = require('./routes/wiseTestRoutes');
const wiseDebugRoutes = require('./routes/wiseDebug');
const wiseTransactionReviewRoutes = require('./routes/wiseTransactionReview');
const wiseSyncRoutes = require('./routes/wiseSync_new');
const settingsRoutes = require('./routes/settingsRoutes');
let classificationRoutes;
try {
  classificationRoutes = require('./routes/classificationRoutes');
  console.log('✓ classificationRoutes loaded successfully');
} catch (err) {
  console.error('✗ Failed to load classificationRoutes:', err.message);
  classificationRoutes = require('express').Router(); // Empty router as fallback
}
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is not set');
  process.exit(1);
}

// Middleware
app.use(cors());

// Parse JSON for all routes EXCEPT webhook (which needs raw body for signature validation)
app.use((req, res, next) => {
  if (req.path === '/api/wise/webhook') {
    next(); // Skip JSON parsing for webhook - it uses express.raw()
  } else {
    express.json()(req, res, next); // Parse JSON for all other routes
  }
});

// Serve static files from public directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/wise', wiseImportRoutes); // CSV upload only
app.use('/api/wise', wiseTransactionReviewRoutes); // Transaction review endpoints
app.use('/api/wise', wiseSyncRoutes); // Wise API sync endpoints
app.use('/api/currency', currencyRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/wise-test', wiseTestRoutes); // Wise API testing endpoints
app.use('/api/wise/debug', wiseDebugRoutes); // Wise profile debugging endpoints
app.use('/api/settings', settingsRoutes); // App settings and OpenAI configuration
app.use('/api/classifications', classificationRoutes); // Expense classifications and AI suggestions

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.4-uuid-fix'
  });
});

// 404 handler for undefined routes (must be BEFORE error handler)
app.use(notFoundHandler);

// Global error handling middleware (must be LAST)
app.use(errorHandler);

// Wise Sync Scheduler (Cron Job)
const cron = require('node-cron');
const { runScheduledSync } = require('./routes/wiseSync_new');

const WISE_SYNC_ENABLED = process.env.WISE_SYNC_ENABLED !== 'false';
const WISE_SYNC_CRON = process.env.WISE_SYNC_CRON || '0 */6 * * *'; // Every 6 hours by default

if (WISE_SYNC_ENABLED) {
  console.log(`📅 Wise sync scheduler enabled: ${WISE_SYNC_CRON}`);

  cron.schedule(WISE_SYNC_CRON, async () => {
    const timestamp = new Date().toISOString();
    console.log(`\n🕐 [${timestamp}] Running scheduled Wise sync...`);

    try {
      const result = await runScheduledSync();
      if (result.success) {
        console.log(`✓ [${timestamp}] Sync completed:`, result.stats);
      } else {
        console.log(`⊘ [${timestamp}] Sync skipped:`, result.message);
      }
    } catch (error) {
      console.error(`✗ [${timestamp}] Sync failed:`, error.message);
    }
  });

  console.log('✓ Wise sync scheduler initialized');
} else {
  console.log('⊘ Wise sync scheduler disabled');
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Railway build trigger - webhook monitor deployed (2025-10-27)
