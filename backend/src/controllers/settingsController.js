const SettingsModel = require('../models/settingsModel');
const OpenAIAnalysisService = require('../services/openaiAnalysisService');

const SettingsController = {
  /**
   * Get all settings
   */
  async getAllSettings(req, res) {
    try {
      const settings = await SettingsModel.getAll();
      res.json({ success: true, data: settings });
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Get OpenAI configuration (safe version without API key)
   */
  async getOpenAIConfig(req, res) {
    try {
      const config = await SettingsModel.getOpenAIConfig();
      res.json({
        success: true,
        data: {
          isConfigured: config.isConfigured,
          enabled: config.enabled,
          model: config.model,
          cacheHours: config.cacheHours
        }
      });
    } catch (error) {
      console.error('Get OpenAI config error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Save OpenAI configuration
   */
  async saveOpenAIConfig(req, res) {
    try {
      const { apiKey, enabled, model, cacheHours } = req.body;

      // Validate model if provided
      const validModels = ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'];
      if (model && !validModels.includes(model)) {
        return res.status(400).json({
          success: false,
          error: `Invalid model. Must be one of: ${validModels.join(', ')}`
        });
      }

      // If new API key provided, validate it
      if (apiKey && apiKey !== '********') {
        const testResult = await OpenAIAnalysisService.testConnection(apiKey);
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            error: `Invalid API key: ${testResult.message}`
          });
        }
      }

      // Build config object (only include fields that were provided)
      const config = {};
      if (apiKey && apiKey !== '********') config.apiKey = apiKey;
      if (enabled !== undefined) config.enabled = enabled;
      if (model) config.model = model;
      if (cacheHours !== undefined) config.cacheHours = parseInt(cacheHours) || 24;

      const savedConfig = await SettingsModel.saveOpenAIConfig(config);

      res.json({
        success: true,
        message: 'OpenAI configuration saved',
        data: {
          isConfigured: savedConfig.isConfigured,
          enabled: savedConfig.enabled,
          model: savedConfig.model,
          cacheHours: savedConfig.cacheHours
        }
      });
    } catch (error) {
      console.error('Save OpenAI config error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Test OpenAI connection
   */
  async testOpenAIConnection(req, res) {
    try {
      const { apiKey } = req.body;

      let keyToTest = apiKey;

      // If no key provided, use stored key
      if (!keyToTest || keyToTest === '********') {
        const config = await SettingsModel.getOpenAIConfig();
        keyToTest = config.apiKey;
      }

      if (!keyToTest) {
        return res.status(400).json({
          success: false,
          error: 'No API key provided or configured'
        });
      }

      const result = await OpenAIAnalysisService.testConnection(keyToTest);
      res.json(result);
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Clear LLM cache
   */
  async clearCache(req, res) {
    try {
      const deleted = await SettingsModel.clearAllCache();
      res.json({
        success: true,
        message: `Cleared ${deleted} cached entries`
      });
    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * Analyze expenses with OpenAI
   */
  async analyzeExpenses(req, res) {
    try {
      const result = await OpenAIAnalysisService.analyzeExpenses();

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: {
          suggestions: result.suggestions,
          fromCache: result.fromCache,
          count: result.suggestions.length
        }
      });
    } catch (error) {
      console.error('Analyze expenses error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = SettingsController;
