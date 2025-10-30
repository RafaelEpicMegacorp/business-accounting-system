/**
 * Currency Formatter Utility
 * Formats amounts with the correct currency symbol
 */

/**
 * Currency symbol mapping for supported currencies
 */
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'PLN': 'zł'
};

/**
 * Format an amount with the correct currency symbol
 * @param {number|string} amount - The amount to format
 * @param {string} currency - The currency code (USD, EUR, GBP, PLN)
 * @returns {string} Formatted currency string (e.g., "$100.00", "zł369.00")
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00';
  }

  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const formattedAmount = parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${symbol}${formattedAmount}`;
};

/**
 * Get currency symbol for a currency code
 * @param {string} currency - The currency code (USD, EUR, GBP, PLN)
 * @returns {string} The currency symbol
 */
export const getCurrencySymbol = (currency = 'USD') => {
  return CURRENCY_SYMBOLS[currency] || currency;
};
