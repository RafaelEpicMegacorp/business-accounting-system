# Frontend API Integration

## Overview

This document explains how to connect the React frontend to the PostgreSQL backend API.

## Setup

### 1. Install Axios

```bash
cd frontend
npm install axios
```

### 2. Create API Service

Create `src/services/api.js`:

```javascript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token (future)
api.interceptors.request.use(
  (config) => {
    // Add auth token when implemented
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 3. Create Entry Service

Create `src/services/entryService.js`:

```javascript
import api from './api';

const entryService = {
  // Get all entries
  async getAll() {
    const response = await api.get('/entries');
    return response.data;
  },

  // Get single entry
  async getById(id) {
    const response = await api.get(`/entries/${id}`);
    return response.data;
  },

  // Create entry
  async create(entry) {
    const response = await api.post('/entries', {
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail,
      baseAmount: parseFloat(entry.baseAmount),
      total: parseFloat(entry.total),
      entryDate: entry.entryDate || new Date().toISOString().split('T')[0]
    });
    return response.data;
  },

  // Update entry
  async update(id, entry) {
    const response = await api.put(`/entries/${id}`, {
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail,
      baseAmount: parseFloat(entry.baseAmount),
      total: parseFloat(entry.total),
      entryDate: entry.entryDate
    });
    return response.data;
  },

  // Delete entry
  async delete(id) {
    const response = await api.delete(`/entries/${id}`);
    return response.data;
  },

  // Get totals
  async getTotals() {
    const response = await api.get('/entries/totals');
    return response.data;
  }
};

export default entryService;
```

### 4. Update Environment Variables

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001/api
```

For production:

```bash
VITE_API_URL=https://your-api-domain.com/api
```

## Updated Component with API Integration

Create `src/components/AccountingApp.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import entryService from '../services/entryService';

export default function AccountingApp() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: 'Employee',
    description: '',
    detail: '',
    baseAmount: '',
    total: '',
    entryDate: new Date().toISOString().split('T')[0]
  });

  const categories = ['Employee', 'Administration', 'Software', 'Marketing', 'Equipment', 'Other'];

  // Load entries on mount
  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await entryService.getAll();
      setEntries(data);
      setError(null);
    } catch (err) {
      setError('Failed to load entries. Please try again.');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.baseAmount || !formData.total) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingId) {
        await entryService.update(editingId, formData);
      } else {
        await entryService.create(formData);
      }
      await loadEntries(); // Reload entries
      resetForm();
    } catch (err) {
      alert('Failed to save entry. Please try again.');
      console.error('Save error:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'expense',
      category: 'Employee',
      description: '',
      detail: '',
      baseAmount: '',
      total: '',
      entryDate: new Date().toISOString().split('T')[0]
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (entry) => {
    setFormData({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail || '',
      baseAmount: entry.base_amount,
      total: entry.total,
      entryDate: entry.entry_date
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await entryService.delete(id);
        await loadEntries(); // Reload entries
      } catch (err) {
        alert('Failed to delete entry. Please try again.');
        console.error('Delete error:', err);
      }
    }
  };

  const totalIncome = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + parseFloat(e.total), 0);

  const totalExpenses = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + parseFloat(e.total), 0);

  const netBalance = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold text-xl mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadEntries}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header and Summary Cards - Same as before */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Accounting</h1>
              <p className="text-gray-600 mt-1">Track your income and expenses</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Add Entry
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="text-green-600" size={32} />
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingDown className="text-red-600" size={32} />
              </div>
            </div>

            <div className={`${netBalance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    Net Balance
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                    ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className={netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'} size={32} />
              </div>
            </div>
          </div>
        </div>

        {/* Form - Add date field */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Entry' : 'Add New Entry'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.entryDate}
                    onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., John Doe, Office Rent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detail (optional)</label>
                  <input
                    type="text"
                    value={formData.detail}
                    onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Additional details"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.baseAmount}
                    onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total (with taxes/fees)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.total}
                    onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  {editingId ? 'Update Entry' : 'Add Entry'}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table - Update to show date and use base_amount */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.type === 'income' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{entry.detail}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${parseFloat(entry.base_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ${parseFloat(entry.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Testing the Integration

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Test CRUD Operations
- Create a new entry
- Edit an existing entry
- Delete an entry
- Verify data persists after page refresh

## Error Handling

The component includes:
- Loading states while fetching data
- Error display with retry option
- Try-catch blocks for all API calls
- User-friendly error messages

## CORS Configuration

If you encounter CORS issues, ensure backend has proper CORS settings in `src/server.js`:

```javascript
app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true
}));
```

## Next Steps

1. Add input validation middleware in backend
2. Implement authentication (JWT)
3. Add pagination for large datasets
4. Implement search and filtering
5. Add export functionality