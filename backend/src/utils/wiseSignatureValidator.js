const crypto = require('crypto');

/**
 * Wise Webhook Signature Validator
 * Validates HMAC-SHA256 signatures from Wise webhooks
 * Documentation: https://docs.wise.com/api-docs/webhooks-notifications/signature-validation
 */
class WiseSignatureValidator {
  /**
   * Validate Wise webhook signature
   * @param {string} signature - X-Signature header from webhook request
   * @param {Object|string} payload - Request body (raw string or parsed object)
   * @param {string} secret - WISE_WEBHOOK_SECRET from environment
   * @returns {boolean} True if signature is valid
   */
  static validate(signature, payload, secret) {
    if (!signature || !secret) {
      console.error('Missing signature or secret for Wise webhook validation');
      return false;
    }

    try {
      // Convert payload to string if it's an object
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // Calculate expected signature using HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      // Compare signatures (timing-safe comparison)
      const actualSignature = signature.toLowerCase();
      const expected = expectedSignature.toLowerCase();

      return crypto.timingSafeEqual(
        Buffer.from(actualSignature),
        Buffer.from(expected)
      );
    } catch (error) {
      console.error('Error validating Wise webhook signature:', error.message);
      return false;
    }
  }

  /**
   * Validate signature from Express request
   * @param {Object} req - Express request object
   * @param {string} secret - WISE_WEBHOOK_SECRET from environment
   * @returns {boolean} True if signature is valid
   */
  static validateRequest(req, secret) {
    const signature = req.headers['x-signature'] || req.headers['x-signature-sha256'];

    if (!signature) {
      console.error('No signature header found in Wise webhook request');
      return false;
    }

    // Get raw body as string (requires body-parser raw middleware)
    const payload = req.rawBody || JSON.stringify(req.body);

    return this.validate(signature, payload, secret);
  }
}

module.exports = WiseSignatureValidator;
