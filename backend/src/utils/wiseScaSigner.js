const crypto = require('crypto');

/**
 * Wise SCA (Strong Customer Authentication) Signer
 *
 * Handles RSA signature generation for Wise API requests requiring SCA.
 *
 * Required for UK/EEA balance statement endpoints due to PSD2 regulations.
 *
 * Flow:
 * 1. Wise returns 403 with x-2fa-approval header containing one-time-token
 * 2. Sign the token with private RSA key (SHA-256)
 * 3. Retry request with X-Signature header containing base64-encoded signature
 *
 * @see https://docs.wise.com/api-docs/guides/strong-customer-authentication
 */
class WiseScaSigner {
  constructor() {
    this.privateKey = process.env.WISE_PRIVATE_KEY;

    if (!this.privateKey) {
      console.warn('WARNING: WISE_PRIVATE_KEY not configured - SCA signing will fail');
    }
  }

  /**
   * Sign a one-time-token for Wise SCA
   * @param {string} oneTimeToken - Token from x-2fa-approval header
   * @returns {string} Base64-encoded RSA-SHA256 signature
   */
  signToken(oneTimeToken) {
    if (!this.privateKey) {
      throw new Error('WISE_PRIVATE_KEY environment variable not set');
    }

    if (!oneTimeToken) {
      throw new Error('One-time-token is required for SCA signing');
    }

    try {
      // Create signature using RSA-SHA256
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(oneTimeToken);
      sign.end();

      // Sign with private key and encode as base64
      const signature = sign.sign(this.privateKey, 'base64');

      console.log(`SCA signature generated for token: ${oneTimeToken.substring(0, 20)}...`);

      return signature;
    } catch (error) {
      console.error('Error signing SCA token:', error.message);
      throw new Error(`Failed to sign SCA token: ${error.message}`);
    }
  }

  /**
   * Check if SCA is configured
   * @returns {boolean} True if private key is available
   */
  isConfigured() {
    return !!this.privateKey;
  }
}

module.exports = new WiseScaSigner();
