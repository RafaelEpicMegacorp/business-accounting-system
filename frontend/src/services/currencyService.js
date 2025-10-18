import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is not set. Please check your .env file.');
}

const currencyService = {
  // Get all currency balances
  getCurrencyBalances: async () => {
    const response = await axios.get(`${API_URL}/currency/balances`);
    return response.data;
  },

  // Get currency summary (with income/expense totals)
  getCurrencySummary: async () => {
    const response = await axios.get(`${API_URL}/currency/summary`);
    return response.data;
  },

  // Get balance for specific currency
  getBalanceByCurrency: async (currency) => {
    const response = await axios.get(`${API_URL}/currency/balances/${currency}`);
    return response.data;
  },

  // Get currency exchanges
  getCurrencyExchanges: async (limit = 100) => {
    const response = await axios.get(`${API_URL}/currency/exchanges`, {
      params: { limit }
    });
    return response.data;
  },

  // Manually trigger balance recalculation
  recalculateBalances: async () => {
    const response = await axios.post(`${API_URL}/currency/recalculate`);
    return response.data;
  }
};

export default currencyService;
