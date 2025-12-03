import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Plus, Check, X, Edit2, Trash2, Sparkles, DollarSign,
  AlertCircle, ChevronDown, ChevronUp, Save, Cpu
} from 'lucide-react';
import forecastService from '../services/forecastService';
import settingsService from '../services/settingsService';

function RecurringExpensesView() {
  const [suggestions, setSuggestions] = useState([]);
  const [savedPatterns, setSavedPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPattern, setEditingPattern] = useState(null);
  const [dismissedPatterns, setDismissedPatterns] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [llmSuggestions, setLlmSuggestions] = useState([]);
  const [aiError, setAiError] = useState(null);

  // Form state for adding/editing
  const [formData, setFormData] = useState({
    description: '',
    category: '',
    typical_amount: '',
    frequency: 'monthly',
    currency: 'USD'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recurringData, patternsData] = await Promise.all([
        forecastService.getRecurringExpenses(),
        forecastService.getSavedPatterns()
      ]);
      setSuggestions(recurringData.patterns || []);
      setSavedPatterns(patternsData || []);
    } catch (error) {
      console.error('Failed to load recurring expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeWithAI = async () => {
    try {
      setAnalyzing(true);
      setAiError(null);
      const response = await settingsService.analyzeExpenses();

      if (response.success) {
        setLlmSuggestions(response.data.suggestions || []);
        if (response.data.suggestions?.length === 0) {
          setAiError('No recurring patterns detected in your expense history.');
        }
      } else {
        setAiError(response.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to analyze expenses. Make sure OpenAI is configured in Settings.';
      setAiError(errorMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatCurrency = (value) => {
    return parseFloat(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getFrequencyLabel = (freq) => {
    const labels = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly'
    };
    return labels[freq] || freq;
  };

  const getMonthlyEquivalent = (amount, frequency) => {
    const amt = parseFloat(amount);
    switch (frequency) {
      case 'weekly': return amt * 4.33;
      case 'monthly': return amt;
      case 'quarterly': return amt / 3;
      case 'yearly': return amt / 12;
      default: return amt;
    }
  };

  const handleConfirmSuggestion = async (pattern) => {
    try {
      await forecastService.savePattern({
        description: pattern.description,
        category: pattern.category,
        typical_amount: pattern.typical_amount,
        currency: pattern.currency || 'USD',
        frequency: pattern.detected_frequency,
        confidence_score: pattern.confidence_score
      });
      await loadData();
    } catch (error) {
      console.error('Failed to save pattern:', error);
      alert('Failed to confirm pattern. Please try again.');
    }
  };

  const handleDismissSuggestion = (pattern) => {
    setDismissedPatterns([...dismissedPatterns, pattern.description]);
  };

  const handleDeletePattern = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recurring expense?')) {
      return;
    }

    try {
      await forecastService.deletePattern(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete pattern:', error);
      alert('Failed to delete pattern. Please try again.');
    }
  };

  const handleSavePattern = async () => {
    if (!formData.description || !formData.typical_amount) {
      alert('Please fill in description and amount');
      return;
    }

    try {
      if (editingPattern) {
        await forecastService.updatePattern(editingPattern.id, {
          description: formData.description,
          category: formData.category,
          typical_amount: parseFloat(formData.typical_amount),
          frequency: formData.frequency
        });
      } else {
        await forecastService.savePattern({
          description: formData.description,
          category: formData.category,
          typical_amount: parseFloat(formData.typical_amount),
          currency: formData.currency,
          frequency: formData.frequency,
          confidence_score: 1.0
        });
      }

      setShowAddModal(false);
      setEditingPattern(null);
      setFormData({
        description: '',
        category: '',
        typical_amount: '',
        frequency: 'monthly',
        currency: 'USD'
      });
      await loadData();
    } catch (error) {
      console.error('Failed to save pattern:', error);
      alert('Failed to save pattern. Please try again.');
    }
  };

  const openEditModal = (pattern) => {
    setEditingPattern(pattern);
    setFormData({
      description: pattern.description,
      category: pattern.category || '',
      typical_amount: pattern.typical_amount,
      frequency: pattern.frequency,
      currency: pattern.currency || 'USD'
    });
    setShowAddModal(true);
  };

  // Filter out dismissed and already saved patterns from suggestions
  const filteredSuggestions = suggestions.filter(s =>
    !dismissedPatterns.includes(s.description) &&
    !savedPatterns.some(p => p.description?.toLowerCase() === s.description?.toLowerCase())
  );

  // Filter LLM suggestions similarly
  const filteredLlmSuggestions = llmSuggestions.filter(s =>
    !dismissedPatterns.includes(s.description) &&
    !savedPatterns.some(p => p.description?.toLowerCase() === s.description?.toLowerCase())
  );

  // Combined count for display
  const totalSuggestions = filteredSuggestions.length + filteredLlmSuggestions.length;

  // Calculate totals
  const monthlyTotal = savedPatterns.reduce((sum, p) =>
    sum + getMonthlyEquivalent(p.typical_amount, p.frequency), 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="animate-spin" size={20} />
          Loading recurring expenses...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="text-purple-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Recurring Expenses</h1>
              <p className="text-sm text-gray-500">Manage your recurring monthly expenses for accurate forecasting</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAnalyzeWithAI}
              disabled={analyzing}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Cpu size={20} />
              )}
              {analyzing ? 'Analyzing...' : 'Analyze with AI'}
            </button>
            <button
              onClick={() => {
                setEditingPattern(null);
                setFormData({
                  description: '',
                  category: '',
                  typical_amount: '',
                  frequency: 'monthly',
                  currency: 'USD'
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              <Plus size={20} />
              Add Manual
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Monthly Total</h3>
            <DollarSign size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">${formatCurrency(monthlyTotal)}</p>
          <p className="text-xs opacity-80 mt-1">From {savedPatterns.length} recurring expenses</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Saved Patterns</h3>
            <Check size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">{savedPatterns.length}</p>
          <p className="text-xs opacity-80 mt-1">Confirmed recurring expenses</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">AI Suggestions</h3>
            <Sparkles size={20} className="opacity-80" />
          </div>
          <p className="text-2xl font-bold">{totalSuggestions}</p>
          <p className="text-xs opacity-80 mt-1">Detected patterns to review</p>
        </div>
      </div>

      {/* AI Analysis Error */}
      {aiError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-amber-800 font-medium">AI Analysis Result</p>
            <p className="text-amber-700 text-sm">{aiError}</p>
          </div>
          <button
            onClick={() => setAiError(null)}
            className="ml-auto text-amber-500 hover:text-amber-700"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* LLM AI Suggestions Section */}
      {filteredLlmSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-purple-200">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="text-purple-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">OpenAI Suggestions</h2>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
              {filteredLlmSuggestions.length} patterns detected
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            These patterns were detected by AI analysis of your expense history. Click "Confirm" to add them.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-purple-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-800 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-800 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-800 uppercase">Frequency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-800 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-800 uppercase">Reasoning</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-purple-800 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-200">
                {filteredLlmSuggestions.map((pattern, index) => (
                  <tr key={`llm-${index}`} className="hover:bg-purple-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                      {pattern.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {pattern.currency} ${formatCurrency(pattern.typical_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getFrequencyLabel(pattern.frequency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-purple-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${pattern.confidence_score * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{Math.round(pattern.confidence_score * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={pattern.reasoning}>
                      {pattern.reasoning}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleConfirmSuggestion(pattern)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Confirm"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(pattern.description)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Dismiss"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SQL AI Suggestions Section */}
      {filteredSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-lg p-6 border border-amber-200">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">AI Suggestions</h2>
              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                {filteredSuggestions.length} patterns detected
              </span>
            </div>
            {showSuggestions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {showSuggestions && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-4">
                These patterns were detected from your expense history. Click "Confirm" to add them to your recurring expenses.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-amber-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Frequency</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Confidence</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200">
                    {filteredSuggestions.map((pattern, index) => (
                      <tr key={index} className="hover:bg-amber-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                          {pattern.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{pattern.category}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            pattern.detected_frequency === 'monthly' ? 'bg-blue-100 text-blue-800' :
                            pattern.detected_frequency === 'weekly' ? 'bg-green-100 text-green-800' :
                            pattern.detected_frequency === 'quarterly' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {getFrequencyLabel(pattern.detected_frequency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          ${formatCurrency(pattern.typical_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  parseFloat(pattern.confidence_score) >= 0.9 ? 'bg-green-500' :
                                  parseFloat(pattern.confidence_score) >= 0.8 ? 'bg-blue-500' :
                                  'bg-orange-500'
                                }`}
                                style={{ width: `${parseFloat(pattern.confidence_score) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {(parseFloat(pattern.confidence_score) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleConfirmSuggestion(pattern)}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                              <Check size={14} />
                              Confirm
                            </button>
                            <button
                              onClick={() => handleDismissSuggestion(pattern)}
                              className="flex items-center gap-1 px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                            >
                              <X size={14} />
                              Dismiss
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved Patterns Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Check className="text-green-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Saved Recurring Expenses</h2>
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
            {savedPatterns.length} expenses
          </span>
        </div>

        {savedPatterns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Category</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Frequency</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Monthly Equiv.</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {savedPatterns.map((pattern) => (
                  <tr key={pattern.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                      {pattern.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pattern.category}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        pattern.frequency === 'monthly' ? 'bg-blue-100 text-blue-800' :
                        pattern.frequency === 'weekly' ? 'bg-green-100 text-green-800' :
                        pattern.frequency === 'quarterly' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getFrequencyLabel(pattern.frequency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      ${formatCurrency(pattern.typical_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-purple-600 font-medium">
                      ${formatCurrency(getMonthlyEquivalent(pattern.typical_amount, pattern.frequency))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(pattern)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeletePattern(pattern.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                    Monthly Total:
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-purple-700">
                    ${formatCurrency(monthlyTotal)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No saved recurring expenses yet.</p>
            <p className="text-sm mt-2">Confirm AI suggestions above or add expenses manually.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPattern ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., AWS Hosting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Software"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.typical_amount}
                    onChange={(e) => setFormData({ ...formData, typical_amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {formData.typical_amount && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-sm text-purple-700">
                    Monthly equivalent: <span className="font-bold">
                      ${formatCurrency(getMonthlyEquivalent(formData.typical_amount, formData.frequency))}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePattern}
                className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {editingPattern ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecurringExpensesView;
