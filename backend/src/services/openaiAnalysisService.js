const OpenAI = require('openai');
const pool = require('../config/database');
const SettingsModel = require('../models/settingsModel');
const crypto = require('crypto');

const OpenAIAnalysisService = {
  /**
   * Analyze expenses using OpenAI to detect recurring patterns
   */
  async analyzeExpenses() {
    // Get OpenAI configuration
    const config = await SettingsModel.getOpenAIConfig();

    if (!config.isConfigured || !config.enabled) {
      return {
        success: false,
        error: 'OpenAI is not configured or enabled',
        suggestions: []
      };
    }

    // Get recent expenses for analysis
    const expenses = await this.getRecentExpenses();

    if (expenses.length < 5) {
      return {
        success: false,
        error: 'Not enough expense data for analysis (minimum 5 entries required)',
        suggestions: []
      };
    }

    // Generate cache key based on expense data hash
    const cacheKey = this.generateCacheKey(expenses);

    // Check cache first
    const cachedResult = await SettingsModel.getCachedResult(cacheKey);
    if (cachedResult) {
      return {
        success: true,
        suggestions: cachedResult,
        fromCache: true
      };
    }

    // Call OpenAI for analysis
    try {
      const suggestions = await this.callOpenAI(expenses, config);

      // Cache the result
      await SettingsModel.setCachedResult(cacheKey, suggestions, config.cacheHours);

      return {
        success: true,
        suggestions,
        fromCache: false
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze expenses with OpenAI',
        suggestions: []
      };
    }
  },

  /**
   * Get recent expenses for analysis
   */
  async getRecentExpenses() {
    const result = await pool.query(`
      SELECT
        id,
        description,
        category,
        total as amount,
        currency,
        entry_date,
        type
      FROM entries
      WHERE type = 'expense'
        AND entry_date >= CURRENT_DATE - INTERVAL '12 months'
        AND total > 0
        AND category NOT IN ('salary', 'Employee')
      ORDER BY entry_date DESC
      LIMIT 500
    `);
    return result.rows;
  },

  /**
   * Generate cache key from expenses
   */
  generateCacheKey(expenses) {
    const data = expenses.map(e => `${e.id}-${e.description}-${e.amount}`).join('|');
    return crypto.createHash('md5').update(data).digest('hex');
  },

  /**
   * Call OpenAI API for expense analysis
   */
  async callOpenAI(expenses, config) {
    const openai = new OpenAI({
      apiKey: config.apiKey
    });

    // Prepare expense summary for the prompt
    const expenseSummary = this.prepareExpenseSummary(expenses);

    const prompt = `You are a financial analyst AI. Analyze the following business expenses and identify recurring expense patterns.

## Expense Data (Last 12 months)
${expenseSummary}

## Task
Identify expenses that appear to be recurring (monthly, weekly, quarterly, or yearly). For each pattern found:
1. Identify the vendor/description
2. Determine the typical amount
3. Estimate the frequency (weekly, monthly, quarterly, yearly)
4. Calculate confidence score (0.5 to 1.0)
5. Provide brief reasoning

## Response Format
Respond with a JSON array of recurring expense patterns. Each pattern should have:
- description: string (vendor/expense name)
- category: string (expense category)
- typical_amount: number (average amount)
- currency: string (USD, EUR, PLN, etc.)
- frequency: string (weekly, monthly, quarterly, yearly)
- confidence_score: number (0.5 to 1.0)
- reasoning: string (brief explanation of why this is recurring)
- occurrence_count: number (how many times it appeared)

Only include patterns with confidence >= 0.6. Return empty array if no clear patterns found.

Return ONLY the JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst AI that identifies recurring expense patterns. Always respond with valid JSON arrays only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the response
    try {
      const parsed = JSON.parse(content);
      // Handle both direct array and object with patterns array
      const patterns = Array.isArray(parsed) ? parsed : (parsed.patterns || parsed.suggestions || []);

      // Validate and normalize patterns
      return patterns.map(p => ({
        description: String(p.description || '').substring(0, 255),
        category: String(p.category || 'Other').substring(0, 100),
        typical_amount: parseFloat(p.typical_amount) || 0,
        currency: String(p.currency || 'USD').substring(0, 3),
        frequency: ['weekly', 'monthly', 'quarterly', 'yearly'].includes(p.frequency) ? p.frequency : 'monthly',
        confidence_score: Math.min(1, Math.max(0.5, parseFloat(p.confidence_score) || 0.7)),
        reasoning: String(p.reasoning || '').substring(0, 500),
        occurrence_count: parseInt(p.occurrence_count) || 1,
        source: 'llm'
      })).filter(p => p.confidence_score >= 0.6 && p.typical_amount > 0);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  },

  /**
   * Prepare expense summary for OpenAI prompt
   */
  prepareExpenseSummary(expenses) {
    // Group expenses by description/vendor
    const grouped = {};
    expenses.forEach(e => {
      const key = e.description.toLowerCase().trim();
      if (!grouped[key]) {
        grouped[key] = {
          description: e.description,
          category: e.category,
          currency: e.currency,
          entries: []
        };
      }
      grouped[key].entries.push({
        amount: parseFloat(e.amount),
        date: e.entry_date
      });
    });

    // Format summary
    const lines = Object.values(grouped)
      .sort((a, b) => b.entries.length - a.entries.length)
      .slice(0, 100) // Limit to top 100 vendors
      .map(g => {
        const amounts = g.entries.map(e => e.amount);
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const dates = g.entries.map(e => new Date(e.date).toISOString().split('T')[0]);
        return `- ${g.description} (${g.category}): ${g.entries.length}x, avg ${g.currency} ${avg.toFixed(2)}, dates: ${dates.slice(0, 5).join(', ')}${dates.length > 5 ? '...' : ''}`;
      });

    return lines.join('\n');
  },

  /**
   * Test OpenAI connection with API key
   */
  async testConnection(apiKey) {
    try {
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
        max_tokens: 10
      });

      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Connection failed'
      };
    }
  }
};

module.exports = OpenAIAnalysisService;
