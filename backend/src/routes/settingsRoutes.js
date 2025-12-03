const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// All settings routes require authentication
router.use(authMiddleware);

// Get all settings
router.get('/', SettingsController.getAllSettings);

// OpenAI configuration
router.get('/openai', SettingsController.getOpenAIConfig);
router.post('/openai', SettingsController.saveOpenAIConfig);
router.post('/openai/test', SettingsController.testOpenAIConnection);

// LLM Analysis
router.post('/openai/analyze', SettingsController.analyzeExpenses);

// Cache management
router.delete('/cache', SettingsController.clearCache);

module.exports = router;
