const pool = require('../config/database');

const SettingsModel = {
  /**
   * Get a setting by key
   */
  async get(key) {
    const result = await pool.query(
      'SELECT * FROM app_settings WHERE key = $1',
      [key]
    );
    return result.rows[0] || null;
  },

  /**
   * Get multiple settings by keys
   */
  async getMultiple(keys) {
    const result = await pool.query(
      'SELECT * FROM app_settings WHERE key = ANY($1)',
      [keys]
    );
    return result.rows;
  },

  /**
   * Get all settings (excludes encrypted values)
   */
  async getAll() {
    const result = await pool.query(
      `SELECT key,
              CASE WHEN is_encrypted THEN '********' ELSE value END as value,
              is_encrypted,
              description,
              updated_at
       FROM app_settings
       ORDER BY key`
    );
    return result.rows;
  },

  /**
   * Set a setting value
   */
  async set(key, value, isEncrypted = false, description = null) {
    const result = await pool.query(
      `INSERT INTO app_settings (key, value, is_encrypted, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key)
       DO UPDATE SET value = $2, is_encrypted = $3, description = COALESCE($4, app_settings.description)
       RETURNING *`,
      [key, value, isEncrypted, description]
    );
    return result.rows[0];
  },

  /**
   * Delete a setting
   */
  async delete(key) {
    const result = await pool.query(
      'DELETE FROM app_settings WHERE key = $1 RETURNING *',
      [key]
    );
    return result.rows[0];
  },

  /**
   * Get OpenAI configuration
   */
  async getOpenAIConfig() {
    const settings = await this.getMultiple([
      'openai_api_key',
      'openai_enabled',
      'openai_model',
      'llm_cache_hours'
    ]);

    const config = {
      apiKey: null,
      enabled: false,
      model: 'gpt-4-turbo-preview',
      cacheHours: 24,
      isConfigured: false
    };

    settings.forEach(s => {
      switch (s.key) {
        case 'openai_api_key':
          config.apiKey = s.value;
          config.isConfigured = !!s.value;
          break;
        case 'openai_enabled':
          config.enabled = s.value === 'true';
          break;
        case 'openai_model':
          config.model = s.value || 'gpt-4-turbo-preview';
          break;
        case 'llm_cache_hours':
          config.cacheHours = parseInt(s.value) || 24;
          break;
      }
    });

    return config;
  },

  /**
   * Save OpenAI configuration
   */
  async saveOpenAIConfig(config) {
    const promises = [];

    if (config.apiKey !== undefined) {
      promises.push(this.set('openai_api_key', config.apiKey, true, 'OpenAI API key'));
    }
    if (config.enabled !== undefined) {
      promises.push(this.set('openai_enabled', String(config.enabled), false, 'Enable OpenAI analysis'));
    }
    if (config.model !== undefined) {
      promises.push(this.set('openai_model', config.model, false, 'OpenAI model to use'));
    }
    if (config.cacheHours !== undefined) {
      promises.push(this.set('llm_cache_hours', String(config.cacheHours), false, 'Cache duration in hours'));
    }

    await Promise.all(promises);
    return this.getOpenAIConfig();
  },

  // ==================
  // Cache Management
  // ==================

  /**
   * Get cached LLM result
   */
  async getCachedResult(cacheKey) {
    const result = await pool.query(
      `SELECT result FROM llm_analysis_cache
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey]
    );
    return result.rows[0]?.result || null;
  },

  /**
   * Set cached LLM result
   */
  async setCachedResult(cacheKey, result, hoursToExpire = 24) {
    await pool.query(
      `INSERT INTO llm_analysis_cache (cache_key, result, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour' * $3)
       ON CONFLICT (cache_key)
       DO UPDATE SET result = $2, expires_at = NOW() + INTERVAL '1 hour' * $3`,
      [cacheKey, JSON.stringify(result), hoursToExpire]
    );
  },

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache() {
    const result = await pool.query(
      'DELETE FROM llm_analysis_cache WHERE expires_at < NOW() RETURNING id'
    );
    return result.rowCount;
  },

  /**
   * Clear all cache
   */
  async clearAllCache() {
    const result = await pool.query('DELETE FROM llm_analysis_cache RETURNING id');
    return result.rowCount;
  }
};

module.exports = SettingsModel;
