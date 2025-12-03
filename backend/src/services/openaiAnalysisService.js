const OpenAI = require('openai');
const pool = require('../config/database');
const SettingsModel = require('../models/settingsModel');
const ClassificationModel = require('../models/classificationModel');
const SuggestionModel = require('../models/suggestionModel');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Confidence threshold - lower to capture more suggestions
const MIN_CONFIDENCE = 0.40;

const OpenAIAnalysisService = {
  /**
   * Enhanced expense analysis with month-by-month breakdown
   */
  async analyzeExpenses(options = {}) {
    const { forceRefresh = false, saveToDb = true } = options;

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

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedResult = await SettingsModel.getCachedResult(cacheKey);
      if (cachedResult) {
        return {
          success: true,
          suggestions: cachedResult.patterns || cachedResult,
          forecast: cachedResult.forecast || null,
          monthlySummary: cachedResult.monthly_summary || null,
          fromCache: true
        };
      }
    }

    // Call OpenAI for analysis
    try {
      const result = await this.callEnhancedOpenAI(expenses, config);

      // Cache the result
      await SettingsModel.setCachedResult(cacheKey, result, config.cacheHours);

      // Save suggestions to database if requested
      if (saveToDb && result.patterns && result.patterns.length > 0) {
        await this.saveSuggestions(result.patterns);
      }

      return {
        success: true,
        suggestions: result.patterns || [],
        forecast: result.next_month_forecast || null,
        monthlySummary: result.monthly_summary || null,
        anomalies: result.anomalies || [],
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
   * Organize expenses by month for AI analysis
   */
  organizeByMonth(expenses) {
    const monthlyData = {};

    expenses.forEach(e => {
      const monthKey = e.entry_date.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          expenses: [],
          total: 0,
          count: 0
        };
      }
      monthlyData[monthKey].expenses.push({
        id: e.id,
        description: e.description,
        amount: parseFloat(e.amount),
        category: e.category,
        date: e.entry_date,
        currency: e.currency
      });
      monthlyData[monthKey].total += parseFloat(e.amount);
      monthlyData[monthKey].count++;
    });

    return monthlyData;
  },

  /**
   * Format monthly data for prompt
   */
  formatMonthlyDataForPrompt(monthlyData) {
    let formatted = '';

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort();

    sortedMonths.forEach(month => {
      const data = monthlyData[month];
      formatted += `\n### ${month} (${data.count} expenses, total: $${data.total.toFixed(2)})\n`;

      // Group by vendor within month
      const byVendor = {};
      data.expenses.forEach(e => {
        const key = e.description.toLowerCase().trim();
        if (!byVendor[key]) {
          byVendor[key] = {
            description: e.description,
            items: [],
            total: 0
          };
        }
        byVendor[key].items.push(e);
        byVendor[key].total += e.amount;
      });

      // Sort by total amount
      const sortedVendors = Object.values(byVendor)
        .sort((a, b) => b.total - a.total)
        .slice(0, 20); // Limit per month

      sortedVendors.forEach(vendor => {
        formatted += `- ${vendor.description}: ${vendor.items.length}x, $${vendor.total.toFixed(2)}\n`;
      });
    });

    return formatted;
  },

  /**
   * Get classification taxonomy for prompt
   */
  async getClassificationTaxonomy() {
    const hierarchy = await ClassificationModel.getHierarchy();

    let taxonomy = '';
    hierarchy.forEach(parent => {
      taxonomy += `- ${parent.name}\n`;
      if (parent.children && parent.children.length > 0) {
        parent.children.forEach(child => {
          taxonomy += `  - ${parent.name} > ${child.name}\n`;
        });
      }
    });

    return taxonomy;
  },

  /**
   * Build learning context from user decisions to improve AI suggestions
   */
  async buildLearningContextPrompt() {
    const learningContext = await SuggestionModel.getLearningContext();

    if (!learningContext ||
        (learningContext.rejected_patterns.length === 0 &&
         learningContext.classification_corrections.length === 0 &&
         learningContext.amount_adjustments.length === 0)) {
      return ''; // No learning data yet
    }

    let prompt = `\n## LEARNING FROM USER FEEDBACK
**CRITICAL**: Use this feedback to improve your suggestions. These are real decisions from the user.

`;

    // Rejected patterns - DO NOT suggest these
    if (learningContext.rejected_patterns.length > 0) {
      prompt += `### REJECTED PATTERNS - DO NOT SUGGEST THESE AGAIN
The user has rejected these suggestions before. Do NOT suggest them again unless you have very strong evidence they are now recurring.

`;
      const rejectedByReason = {};
      learningContext.rejected_patterns.forEach(p => {
        const reason = p.rejection_reason || 'unspecified';
        if (!rejectedByReason[reason]) {
          rejectedByReason[reason] = [];
        }
        rejectedByReason[reason].push(p);
      });

      Object.entries(rejectedByReason).forEach(([reason, patterns]) => {
        const reasonLabel = {
          'not_recurring': 'Not a recurring expense',
          'wrong_amount': 'Incorrect amount',
          'wrong_classification': 'Wrong category',
          'already_tracked': 'Already being tracked',
          'duplicate': 'Duplicate suggestion',
          'other': 'Other reasons',
          'unspecified': 'Unspecified reason'
        }[reason] || reason;

        prompt += `**${reasonLabel}:**\n`;
        patterns.slice(0, 10).forEach(p => {
          prompt += `- "${p.description}" (rejected ${p.rejection_count}x)\n`;
        });
        prompt += '\n';
      });
    }

    // Classification corrections - learn user preferences
    if (learningContext.classification_corrections.length > 0) {
      prompt += `### USER CLASSIFICATION CORRECTIONS
When you suggested one category, the user chose a different one. Learn from these corrections:

`;
      learningContext.classification_corrections.slice(0, 15).forEach(c => {
        prompt += `- "${c.description}": You suggested "${c.suggested_classification_name}", user changed to "${c.final_classification_name}" (${c.correction_count}x)\n`;
      });
      prompt += '\n';
    }

    // Amount adjustments - learn better amounts
    if (learningContext.amount_adjustments.length > 0) {
      prompt += `### AMOUNT ADJUSTMENTS
The user corrected your amount estimates. Use these to improve accuracy:

`;
      learningContext.amount_adjustments.slice(0, 10).forEach(a => {
        const suggestedAmt = parseFloat(a.avg_suggested_amount).toFixed(2);
        const finalAmt = parseFloat(a.avg_final_amount).toFixed(2);
        const diff = ((parseFloat(a.avg_final_amount) - parseFloat(a.avg_suggested_amount)) / parseFloat(a.avg_suggested_amount) * 100).toFixed(0);
        prompt += `- "${a.description}": You suggested $${suggestedAmt}, user corrected to $${finalAmt} (${diff > 0 ? '+' : ''}${diff}%)\n`;
      });
      prompt += '\n';
    }

    // Overall stats for context
    if (learningContext.stats) {
      const stats = learningContext.stats;
      const acceptanceRate = stats.total > 0
        ? ((parseInt(stats.accepted) / parseInt(stats.total)) * 100).toFixed(0)
        : 0;

      if (parseInt(stats.total) > 5) {
        prompt += `### YOUR HISTORICAL PERFORMANCE
- Total suggestions reviewed: ${stats.total}
- Acceptance rate: ${acceptanceRate}%
- Average confidence of accepted suggestions: ${parseFloat(stats.avg_accepted_confidence || 0.7).toFixed(2)}

`;
        if (acceptanceRate < 50) {
          prompt += `**Note**: Acceptance rate is below 50%. Be more conservative with suggestions and focus on clear patterns.\n\n`;
        }
      }
    }

    return prompt;
  },

  /**
   * Enhanced OpenAI API call with month-by-month analysis
   */
  async callEnhancedOpenAI(expenses, config) {
    const openai = new OpenAI({
      apiKey: config.apiKey
    });

    // Organize data by month
    const monthlyData = this.organizeByMonth(expenses);
    const formattedMonthlyData = this.formatMonthlyDataForPrompt(monthlyData);

    // Get classification taxonomy
    const taxonomy = await this.getClassificationTaxonomy();

    // Get learning context from user decisions
    const learningContext = await this.buildLearningContextPrompt();

    // Calculate next month for forecasting
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = nextMonth.toISOString().substring(0, 7);

    const prompt = `You are a financial analyst AI specializing in business expense pattern detection.
Your task is to analyze expense data organized by month and identify ALL potential recurring patterns.

## Your Analysis Goals
1. **Detect ALL recurring patterns** - Be liberal in detection. Include anything that appears 2+ times.
2. **Classify each expense** - Assign to the most appropriate category from the taxonomy below.
3. **Detect trends** - Is this expense increasing, decreasing, or stable over time?
4. **Forecast next occurrence** - When and how much should this expense be next?

## Important Considerations
- **Variable amounts are OK**: Utility bills vary month to month but are still recurring.
- **Timing variations are OK**: An expense on the 1st one month and 5th the next is still monthly.
- **Fuzzy match descriptions**: "AWS" and "Amazon Web Services" are the same vendor.
- **Flag new patterns**: Expenses appearing only 2-3 times are "potential new recurring".
- **Detect cancelled subscriptions**: If something stopped appearing, note it.
${learningContext}
## Classification Taxonomy
${taxonomy}

## Expense Data by Month
${formattedMonthlyData}

## Required Response Format (JSON)
{
  "patterns": [
    {
      "description": "Vendor/expense name",
      "classification": "Parent Category > Subcategory",
      "typical_amount": 99.99,
      "amount_variance": 5.00,
      "currency": "USD",
      "frequency": "monthly",
      "confidence_score": 0.85,
      "trend": "stable",
      "trend_rate": 0.05,
      "occurrence_count": 6,
      "last_occurrence": "2025-11-15",
      "next_expected_date": "${nextMonthStr}-15",
      "next_expected_amount": 99.99,
      "reasoning": "Brief explanation of why this is recurring",
      "status": "established"
    }
  ],
  "monthly_summary": {
    "2025-11": { "total": 1500.00, "recurring_total": 1200.00, "one_time_total": 300.00 }
  },
  "next_month_forecast": {
    "month": "${nextMonthStr}",
    "expected_total": 1450.00,
    "confidence": 0.82,
    "breakdown": [
      { "description": "Netflix", "amount": 15.99, "expected_date": "${nextMonthStr}-15", "confidence": 0.95 }
    ]
  },
  "anomalies": [
    { "description": "Unusual expense", "month": "2025-11", "amount": 500.00, "reason": "Not seen before" }
  ]
}

## Important Rules
1. Include patterns with confidence >= ${MIN_CONFIDENCE} (we want more suggestions, users will confirm)
2. frequency must be one of: weekly, monthly, quarterly, yearly
3. trend must be one of: increasing, decreasing, stable
4. status must be one of: established (6+ occurrences), new (2-5 occurrences), cancelled (missing 2+ months)
5. Always provide next_expected_date and next_expected_amount for active patterns
6. Return empty arrays if no patterns found (valid response)

Return ONLY valid JSON, no markdown or explanation outside the JSON.`;

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a financial analyst AI that identifies recurring expense patterns and forecasts future expenses. Always respond with valid JSON only, no markdown code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse the response
    try {
      const parsed = JSON.parse(content);

      // Validate and normalize patterns
      const patterns = (parsed.patterns || []).map(p => this.normalizePattern(p))
        .filter(p => p.confidence_score >= MIN_CONFIDENCE && p.typical_amount > 0);

      return {
        patterns,
        monthly_summary: parsed.monthly_summary || {},
        next_month_forecast: parsed.next_month_forecast || null,
        anomalies: parsed.anomalies || []
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  },

  /**
   * Normalize a pattern from AI response
   */
  normalizePattern(p) {
    return {
      description: String(p.description || '').substring(0, 255),
      classification: String(p.classification || 'Other').substring(0, 100),
      typical_amount: parseFloat(p.typical_amount) || 0,
      amount_variance: parseFloat(p.amount_variance) || 0,
      currency: String(p.currency || 'USD').substring(0, 3).toUpperCase(),
      frequency: ['weekly', 'monthly', 'quarterly', 'yearly'].includes(p.frequency) ? p.frequency : 'monthly',
      confidence_score: Math.min(1, Math.max(0, parseFloat(p.confidence_score) || 0.5)),
      trend: ['increasing', 'decreasing', 'stable'].includes(p.trend) ? p.trend : 'stable',
      trend_rate: parseFloat(p.trend_rate) || 0,
      occurrence_count: parseInt(p.occurrence_count) || 1,
      last_occurrence: p.last_occurrence || null,
      next_expected_date: p.next_expected_date || null,
      next_expected_amount: parseFloat(p.next_expected_amount) || parseFloat(p.typical_amount) || 0,
      reasoning: String(p.reasoning || '').substring(0, 500),
      status: ['established', 'new', 'cancelled'].includes(p.status) ? p.status : 'new',
      source: 'llm'
    };
  },

  /**
   * Save suggestions to database
   */
  async saveSuggestions(patterns) {
    const batchId = uuidv4();

    // Clear old pending suggestions
    await SuggestionModel.clearPending();

    for (const pattern of patterns) {
      // Find classification ID
      let classificationId = null;
      if (pattern.classification) {
        const classification = await ClassificationModel.getByPath(pattern.classification);
        if (classification) {
          classificationId = classification.id;
        }
      }

      await SuggestionModel.create({
        description: pattern.description,
        suggested_classification_id: classificationId,
        typical_amount: pattern.typical_amount,
        amount_variance: pattern.amount_variance,
        currency: pattern.currency,
        frequency: pattern.frequency,
        confidence_score: pattern.confidence_score,
        trend: pattern.trend,
        trend_rate: pattern.trend_rate,
        reasoning: pattern.reasoning,
        source_entry_ids: null,
        occurrence_count: pattern.occurrence_count,
        last_occurrence: pattern.last_occurrence,
        next_expected_date: pattern.next_expected_date,
        next_expected_amount: pattern.next_expected_amount,
        analysis_batch_id: batchId
      });
    }

    return batchId;
  },

  /**
   * Get next month forecast
   */
  async getNextMonthForecast() {
    // First try to get from cached analysis
    const config = await SettingsModel.getOpenAIConfig();
    if (!config.isConfigured || !config.enabled) {
      return this.getSQLBasedForecast();
    }

    // Run analysis which includes forecast
    const result = await this.analyzeExpenses({ saveToDb: false });

    if (result.success && result.forecast) {
      return {
        success: true,
        forecast: result.forecast
      };
    }

    // Fallback to SQL-based forecast
    return this.getSQLBasedForecast();
  },

  /**
   * SQL-based forecast (fallback when AI not available)
   */
  async getSQLBasedForecast() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = nextMonth.toISOString().substring(0, 7);

    const result = await pool.query(`
      SELECT
        p.description,
        p.typical_amount as amount,
        p.frequency,
        p.next_expected_date as expected_date,
        p.confidence_score as confidence
      FROM recurring_expense_patterns p
      WHERE p.is_active = true
        AND (p.next_expected_date IS NULL OR p.next_expected_date >= CURRENT_DATE)
      ORDER BY p.typical_amount DESC
    `);

    const breakdown = result.rows;
    const total = breakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const avgConfidence = breakdown.length > 0
      ? breakdown.reduce((sum, item) => sum + parseFloat(item.confidence || 0.7), 0) / breakdown.length
      : 0;

    return {
      success: true,
      forecast: {
        month: nextMonthStr,
        expected_total: total,
        confidence: avgConfidence,
        breakdown
      }
    };
  },

  /**
   * Compare two months
   */
  async compareMonths(month1, month2) {
    const config = await SettingsModel.getOpenAIConfig();

    if (!config.isConfigured || !config.enabled) {
      return {
        success: false,
        error: 'OpenAI is not configured or enabled'
      };
    }

    // Get expenses for both months
    const expenses1 = await this.getExpensesForMonth(month1);
    const expenses2 = await this.getExpensesForMonth(month2);

    const openai = new OpenAI({ apiKey: config.apiKey });

    const prompt = `Compare expenses between two months and identify changes.

## Previous Month: ${month1}
${this.formatExpensesSimple(expenses1)}

## Current Month: ${month2}
${this.formatExpensesSimple(expenses2)}

## Analysis Required
1. **New expenses**: What appeared this month that wasn't last month?
2. **Missing expenses**: What was expected but didn't appear?
3. **Amount changes**: Significant increases or decreases (>20%)
4. **Category shifts**: Expenses that might need re-classification

## Response Format (JSON)
{
  "new_expenses": [
    { "description": "...", "amount": 99.99, "assessment": "likely recurring" }
  ],
  "missing_expected": [
    { "description": "...", "expected_amount": 99.99, "last_seen": "${month1}", "concern_level": "high" }
  ],
  "significant_changes": [
    { "description": "...", "previous_amount": 100, "current_amount": 150, "change_percent": 50 }
  ],
  "summary": {
    "total_change": 250.00,
    "change_percent": 15.5,
    "assessment": "Brief assessment"
  }
}`;

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a financial analyst. Respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
      success: true,
      comparison: parsed
    };
  },

  /**
   * Get expenses for a specific month
   */
  async getExpensesForMonth(month) {
    const result = await pool.query(`
      SELECT description, category, total as amount, currency, entry_date
      FROM entries
      WHERE type = 'expense'
        AND to_char(entry_date, 'YYYY-MM') = $1
        AND category NOT IN ('salary', 'Employee')
      ORDER BY total DESC
    `, [month]);
    return result.rows;
  },

  /**
   * Format expenses simply for comparison prompt
   */
  formatExpensesSimple(expenses) {
    if (!expenses || expenses.length === 0) return 'No expenses';

    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const lines = expenses.map(e =>
      `- ${e.description}: $${parseFloat(e.amount).toFixed(2)}`
    );

    return `Total: $${total.toFixed(2)}\n${lines.join('\n')}`;
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
