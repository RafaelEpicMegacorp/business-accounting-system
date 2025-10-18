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
    let rawKey = process.env.WISE_PRIVATE_KEY;

    if (!rawKey) {
      console.warn('WARNING: WISE_PRIVATE_KEY not configured - SCA signing will fail');
      this.privateKey = null;
      return;
    }

    // Handle both PEM format and base64-encoded single-line format
    if (rawKey.startsWith('-----BEGIN')) {
      // Already in PEM format
      this.privateKey = rawKey;
      console.log('Using WISE_PRIVATE_KEY in PEM format directly');
    } else {
      // Assume base64-encoded single-line format - decode to PEM
      try {
        const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
        this.privateKey = decoded;
        console.log('Decoded WISE_PRIVATE_KEY from base64 format');
        console.log('Decoded key starts with:', decoded.substring(0, 30));
        console.log('Decoded key ends with:', decoded.substring(decoded.length - 30));
        console.log('Decoded key length:', decoded.length);
      } catch (error) {
        console.error('Failed to decode WISE_PRIVATE_KEY:', error.message);
        this.privateKey = rawKey; // Try using as-is
      }
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
      // Convert token to Buffer using 'ascii' encoding (matching Python example)
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(Buffer.from(oneTimeToken, 'ascii'));
      sign.end();

      // Sign with private key and encode as base64
      const signature = sign.sign(this.privateKey, 'base64');

      console.log(`SCA signature generated for token: ${oneTimeToken.substring(0, 20)}...`);
      console.log(`Signature (first 30 chars): ${signature.substring(0, 30)}...`);

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
