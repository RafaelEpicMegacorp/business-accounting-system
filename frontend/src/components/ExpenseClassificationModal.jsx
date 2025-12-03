import React, { useState, useEffect } from 'react';
import { X, Check, Edit3, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import classificationService from '../services/classificationService';

export default function ExpenseClassificationModal({ suggestion, onClose, onAccept, onReject }) {
  const [classifications, setClassifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [modifications, setModifications] = useState({
    classification_id: suggestion?.suggested_classification_id || null,
    amount: suggestion?.typical_amount || 0,
    frequency: suggestion?.frequency || 'monthly',
    notes: ''
  });

  useEffect(() => {
    loadClassifications();
  }, []);

  const loadClassifications = async () => {
    try {
      const response = await classificationService.getHierarchy();
      if (response.success) {
        setClassifications(response.data);
      }
    } catch (error) {
      console.error('Failed to load classifications:', error);
    }
  };

  const handleAccept = async () => {
    setLoading(true);
    try {
      if (isModifying) {
        await onAccept(suggestion.id, modifications);
      } else {
        await onAccept(suggestion.id, null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(suggestion.id, modifications.notes || null);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-orange-600 bg-orange-100';
  };

  const getStatusBadge = (status) => {
    const badges = {
      established: { color: 'bg-green-100 text-green-700', label: 'Established' },
      new: { color: 'bg-blue-100 text-blue-700', label: 'New Pattern' },
      cancelled: { color: 'bg-gray-100 text-gray-700', label: 'Cancelled' }
    };
    const badge = badges[status] || badges.new;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Review AI Suggestion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Info */}
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-xl font-medium text-gray-900">{suggestion.description}</h4>
              <p className="text-sm text-gray-500 mt-1">
                {suggestion.suggested_classification_parent
                  ? `${suggestion.suggested_classification_parent} > ${suggestion.suggested_classification_name}`
                  : suggestion.suggested_classification_name || 'Uncategorized'}
              </p>
            </div>
            {getStatusBadge(suggestion.status)}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Amount</p>
              <p className="text-lg font-semibold">
                {suggestion.currency} {parseFloat(suggestion.typical_amount).toFixed(2)}
              </p>
              {suggestion.amount_variance > 0 && (
                <p className="text-xs text-gray-400">±{suggestion.amount_variance.toFixed(2)}</p>
              )}
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Frequency</p>
              <p className="text-lg font-semibold capitalize">{suggestion.frequency}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Confidence</p>
              <p className={`text-lg font-semibold px-2 py-0.5 rounded inline-block ${getConfidenceColor(suggestion.confidence_score)}`}>
                {(suggestion.confidence_score * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Trend</p>
              <div className="flex items-center gap-2">
                {getTrendIcon(suggestion.trend)}
                <span className="text-lg font-semibold capitalize">{suggestion.trend || 'Stable'}</span>
              </div>
            </div>
          </div>

          {/* Occurrences & Forecast */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700">Occurrence History</p>
              <p className="text-2xl font-bold text-gray-900">{suggestion.occurrence_count}x</p>
              {suggestion.last_occurrence && (
                <p className="text-sm text-gray-500">
                  Last: {new Date(suggestion.last_occurrence).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700">Next Expected</p>
              {suggestion.next_expected_date ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">
                    {suggestion.currency} {parseFloat(suggestion.next_expected_amount).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">
                    On {new Date(suggestion.next_expected_date).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="text-gray-400">Not forecasted</p>
              )}
            </div>
          </div>

          {/* AI Reasoning */}
          {suggestion.reasoning && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">AI Analysis</span>
              </div>
              <p className="text-sm text-purple-900">{suggestion.reasoning}</p>
            </div>
          )}

          {/* Modification Section */}
          {isModifying && (
            <div className="border-t pt-4 space-y-4">
              <h5 className="font-medium text-gray-900">Modify Before Accepting</h5>

              {/* Classification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classification
                </label>
                <select
                  value={modifications.classification_id || ''}
                  onChange={(e) => setModifications({
                    ...modifications,
                    classification_id: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select classification...</option>
                  {classifications.map(parent => (
                    <optgroup key={parent.id} label={parent.name}>
                      {parent.children?.map(child => (
                        <option key={child.id} value={child.id}>
                          {parent.name} &gt; {child.name}
                        </option>
                      ))}
                      <option value={parent.id}>{parent.name} (General)</option>
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={modifications.amount}
                    onChange={(e) => setModifications({
                      ...modifications,
                      amount: parseFloat(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={modifications.frequency}
                    onChange={(e) => setModifications({
                      ...modifications,
                      frequency: e.target.value
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={modifications.notes}
                  onChange={(e) => setModifications({ ...modifications, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
          >
            Reject
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModifying(!isModifying)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              {isModifying ? 'Cancel Edit' : 'Modify'}
            </button>
            <button
              onClick={handleAccept}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isModifying ? 'Save & Accept' : 'Accept'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
