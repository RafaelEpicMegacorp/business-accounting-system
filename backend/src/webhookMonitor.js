/**
 * Webhook Monitor - In-Memory Storage
 *
 * Stores recent webhook calls for real-time monitoring via web interface
 */

class WebhookMonitor {
  constructor(maxWebhooks = 100) {
    this.webhooks = [];
    this.maxWebhooks = maxWebhooks;
    this.stats = {
      total: 0,
      errors: 0,
      success: 0
    };
  }

  /**
   * Log a webhook call
   */
  logWebhook(webhookData) {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      ...webhookData
    };

    this.webhooks.unshift(entry); // Add to beginning

    // Keep only last N webhooks
    if (this.webhooks.length > this.maxWebhooks) {
      this.webhooks.pop();
    }

    // Update stats
    this.stats.total++;
    if (webhookData.error) {
      this.stats.errors++;
    } else {
      this.stats.success++;
    }

    return entry;
  }

  /**
   * Get recent webhooks
   */
  getRecentWebhooks(limit = 50) {
    return this.webhooks.slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      inMemory: this.webhooks.length
    };
  }

  /**
   * Clear all webhooks
   */
  clear() {
    this.webhooks = [];
    this.stats = {
      total: 0,
      errors: 0,
      success: 0
    };
  }
}

// Singleton instance
const webhookMonitor = new WebhookMonitor();

module.exports = webhookMonitor;
