# Main Component Code

## AccountingApp.jsx

```jsx
import React, { useState } from 'react';
import { Plus, Trash2, Edit2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export default function AccountingApp() {
  // Initial data from spreadsheet
  const [entries, setEntries] = useState([
    { id: 1, type: 'expense', category: 'Employee', description: 'Salary', detail: 'AJ', baseAmount: 10000, total: 10000 },
    { id: 2, type: 'expense', category: 'Employee', description: 'Asif', detail: 'Employee', baseAmount: 3000, total: 3360 },
    { id: 3, type: 'expense', category: 'Employee', description: 'Shaheer', detail: 'Employee', baseAmount: 3000, total: 3360 },
    { id: 4, type: 'expense', category: 'Employee', description: 'Danche', detail: 'Employee', baseAmount: 2800, total: 3136 },
    { id: 5, type: 'expense', category: 'Employee', description: 'Rohit', detail: 'Employee', baseAmount: 0, total: 0 },
    { id: 6, type: 'expense', category: 'Employee', description: 'Yavuz', detail: 'Employee', baseAmount: 3000, total: 3360 },
    { id: 7, type: 'expense', category: 'Employee', description: 'Tihomir', detail: 'Employee', baseAmount: 100, total: 112 },
    { id: 8, type: 'expense', category: 'Employee', description: 'Mariele', detail: 'Employee', baseAmount: 1600, total: 1792 },
    { id: 9, type: 'expense', category: 'Employee', description: 'Joel', detail: 'Employee', baseAmount: 1600, total: 1792 },
    { id: 10, type: 'expense', category: 'Administration', description: 'Rent', detail: '', baseAmount: 1000, total: 1120 },
    { id: 11, type: 'expense', category: 'Administration', description: 'Internet/Electricity', detail: '', baseAmount: 250, total: 280 },
    { id: 12, type: 'expense', category: 'Employee', description: 'Rafael', detail: 'Employee', baseAmount: 10000, total: 11200 },
    { id: 13, type: 'expense', category: 'Employee', description: 'Bushan', detail: 'Employee', baseAmount: 3000, total: 3360 },
    { id: 14, type: 'expense', category: 'Software', description: 'Softwares', detail: 'Clickup, Slack, Google Cloud, Claude', baseAmount: 1200, total: 1344 },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: 'Employee',
    description: '',
    detail: '',
    baseAmount: '',
    total: ''
  });

  const categories = ['Employee', 'Administration', 'Software', 'Marketing', 'Equipment', 'Other'];

  const handleSubmit = () => {
    if (!formData.description || !formData.baseAmount || !formData.total) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingId) {
      setEntries(entries.map(entry => 
        entry.id === editingId 
          ? { ...formData, id: editingId, baseAmount: Number(formData.baseAmount), total: Number(formData.total) }
          : entry
      ));
      setEditingId(null);
    } else {
      const newEntry = {
        id: Date.now(),
        ...formData,
        baseAmount: Number(formData.baseAmount),
        total: Number(formData.total)
      };
      setEntries([...entries, newEntry]);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      type: 'expense',
      category: 'Employee',
      description: '',
      detail: '',
      baseAmount: '',
      total: ''
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (entry) => {
    setFormData({
      type: entry.type,
      category: entry.category,
      description: entry.description,
      detail: entry.detail,
      baseAmount: entry.baseAmount,
      total: entry.total
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      setEntries(entries.filter(entry => entry.id !== id));
    }
  };

  const totalIncome = entries
    .filter(e => e.type === 'income')
    .reduce((sum, e) => sum + e.total, 0);

  const totalExpenses = entries
    .filter(e => e.type === 'expense')
    .reduce((sum, e) => sum + e.total, 0);

  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
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

          {/* Summary Cards */}
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

        {/* Entry Form */}
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

        {/* Entries Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
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
                      ${entry.baseAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      ${entry.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

## Component Structure

### State Management
- `entries`: Array of all financial entries
- `showForm`: Boolean to toggle form visibility
- `editingId`: ID of entry being edited (null if adding new)
- `formData`: Current form field values

### Key Functions
- `handleSubmit()`: Adds new entry or updates existing one
- `resetForm()`: Clears form and closes it
- `handleEdit(entry)`: Loads entry data into form for editing
- `handleDelete(id)`: Removes entry after confirmation
- Computed totals: `totalIncome`, `totalExpenses`, `netBalance`

### UI Sections
1. **Header**: Title and "Add Entry" button
2. **Summary Cards**: Three cards showing income, expenses, and balance
3. **Entry Form**: Conditional form for adding/editing entries
4. **Data Table**: List of all entries with edit/delete actions