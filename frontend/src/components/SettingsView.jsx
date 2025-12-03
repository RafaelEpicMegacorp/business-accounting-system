import React, { useState, useEffect } from 'react';
import { Settings, Key, Cpu, Check, X, RefreshCw, Trash2, Eye, EyeOff, ChevronDown, ChevronRight, History, Brain, AlertTriangle, TrendingUp } from 'lucide-react';
import settingsService from '../services/settingsService';

export default function SettingsView() {
  const [config, setConfig] = useState({
    isConfigured: false,
    enabled: false,
    model: 'gpt-4-turbo-preview',
    cacheHours: 24
  });
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [message, setMessage] = useState(null);

  // Decision history state
  const [showDecisionHistory, setShowDecisionHistory] = useState(false);
  const [decisionStats, setDecisionStats] = useState(null);
  const [decisionHistory, setDecisionHistory] = useState({ decisions: [], total: 0 });
  const [decisionFilter, setDecisionFilter] = useState('');
  const [decisionPage, setDecisionPage] = useState(0);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [showLearningContext, setShowLearningContext] = useState(false);
  const [learningContext, setLearningContext] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (showDecisionHistory) {
      loadDecisionStats();
      loadDecisionHistory();
    }
  }, [showDecisionHistory, decisionFilter, decisionPage]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getOpenAIConfig();
      if (response.success) {
        setConfig(response.data);
        if (response.data.isConfigured) {
          setApiKey('********');
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const saveData = {
        enabled: config.enabled,
        model: config.model,
        cacheHours: config.cacheHours
      };

      // Only include API key if it was changed
      if (apiKey && apiKey !== '********') {
        saveData.apiKey = apiKey;
      }

      const response = await settingsService.saveOpenAIConfig(saveData);

      if (response.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
        setConfig(response.data);
        if (response.data.isConfigured) {
          setApiKey('********');
        }
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to save' });
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      const keyToTest = apiKey !== '********' ? apiKey : null;
      const response = await settingsService.testConnection(keyToTest);

      setTestResult(response);
    } catch (error) {
      console.error('Test error:', error);
      setTestResult({ success: false, message: error.response?.data?.error || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await settingsService.clearCache();
      if (response.success) {
        setMessage({ type: 'success', text: response.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear cache' });
    }
  };

  const loadDecisionStats = async () => {
    try {
      const response = await settingsService.getDecisionStats();
      if (response.success) {
        setDecisionStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load decision stats:', error);
    }
  };

  const loadDecisionHistory = async () => {
    try {
      setLoadingDecisions(true);
      const response = await settingsService.getDecisionHistory({
        decision: decisionFilter || undefined,
        limit: 20,
        offset: decisionPage * 20
      });
      if (response.success) {
        setDecisionHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to load decision history:', error);
    } finally {
      setLoadingDecisions(false);
    }
  };

  const loadLearningContext = async () => {
    try {
      const response = await settingsService.getLearningContext();
      if (response.success) {
        setLearningContext(response.data);
        setShowLearningContext(true);
      }
    } catch (error) {
      console.error('Failed to load learning context:', error);
    }
  };

  const handleClearRejectedHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all rejected decision history? This will allow the AI to suggest previously rejected items again.')) {
      return;
    }

    try {
      setClearingHistory(true);
      const response = await settingsService.clearRejectedHistory();
      if (response.success) {
        setMessage({ type: 'success', text: response.message });
        loadDecisionStats();
        loadDecisionHistory();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear rejected history' });
    } finally {
      setClearingHistory(false);
    }
  };

  const getRejectionReasonLabel = (reason) => {
    const labels = {
      'not_recurring': 'Not Recurring',
      'wrong_amount': 'Wrong Amount',
      'wrong_classification': 'Wrong Category',
      'already_tracked': 'Already Tracked',
      'duplicate': 'Duplicate',
      'other': 'Other'
    };
    return labels[reason] || reason || 'Unspecified';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Settings className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-gray-600">Configure application settings and integrations</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* OpenAI Configuration */}
      <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Cpu className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">OpenAI Integration</h3>
            <p className="text-sm text-gray-600">Configure AI-powered expense analysis</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Enable AI Analysis</p>
              <p className="text-sm text-gray-600">Use OpenAI to detect recurring expense patterns</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.enabled ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">platform.openai.com</a>
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Model
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="gpt-4-turbo-preview">GPT-4 Turbo (Recommended)</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster, cheaper)</option>
            </select>
          </div>

          {/* Cache Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cache Duration (hours)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={config.cacheHours}
              onChange={(e) => setConfig({ ...config, cacheHours: parseInt(e.target.value) || 24 })}
              className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              How long to cache AI analysis results (saves API costs)
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleTest}
              disabled={testing || !apiKey}
              className="px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              Test Connection
            </button>
            {testResult && (
              <span className={`flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {testResult.message}
              </span>
            )}
          </div>

          {/* Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Status:</strong>{' '}
              {config.isConfigured ? (
                <span className="text-green-600">Configured</span>
              ) : (
                <span className="text-yellow-600">Not configured</span>
              )}
              {config.isConfigured && (
                <>
                  {' '}&bull;{' '}
                  {config.enabled ? (
                    <span className="text-green-600">Enabled</span>
                  ) : (
                    <span className="text-gray-500">Disabled</span>
                  )}
                </>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={handleClearCache}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear Cache
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* AI Decision History Section */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <button
          onClick={() => setShowDecisionHistory(!showDecisionHistory)}
          className="w-full p-6 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <History className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900">AI Decision History</h3>
              <p className="text-sm text-gray-600">View and manage your AI suggestion decisions</p>
            </div>
          </div>
          {showDecisionHistory ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showDecisionHistory && (
          <div className="p-6 pt-0 space-y-6">
            {/* Statistics Cards */}
            {decisionStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Total Decisions</p>
                  <p className="text-2xl font-bold text-gray-900">{decisionStats.total_decisions || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-xs text-green-600 uppercase">Accepted</p>
                  <p className="text-2xl font-bold text-green-700">{decisionStats.accepted_count || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-xs text-red-600 uppercase">Rejected</p>
                  <p className="text-2xl font-bold text-red-700">{decisionStats.rejected_count || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-xs text-purple-600 uppercase">Acceptance Rate</p>
                  <p className="text-2xl font-bold text-purple-700">{decisionStats.acceptance_rate || 0}%</p>
                </div>
              </div>
            )}

            {/* Common Rejections Warning */}
            {decisionStats?.common_rejection_reasons?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Common Rejection Reasons</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {decisionStats.common_rejection_reasons.map((r, i) => (
                    <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-sm rounded">
                      {getRejectionReasonLabel(r.rejection_reason)}: {r.count}x
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Classification Corrections */}
            {decisionStats?.classification_corrections?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Classification Corrections (AI is learning)</span>
                </div>
                <div className="space-y-1 text-sm">
                  {decisionStats.classification_corrections.slice(0, 5).map((c, i) => (
                    <p key={i} className="text-blue-800">
                      <span className="line-through text-blue-500">{c.suggested_classification_name}</span>
                      {' → '}
                      <span className="font-medium">{c.final_classification_name}</span>
                      <span className="text-blue-500 ml-1">({c.count}x)</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Filter and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={decisionFilter}
                  onChange={(e) => {
                    setDecisionFilter(e.target.value);
                    setDecisionPage(0);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Decisions</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadLearningContext}
                  className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2"
                >
                  <Brain className="w-4 h-4" />
                  View Learning Context
                </button>
                <button
                  onClick={handleClearRejectedHistory}
                  disabled={clearingHistory}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Rejected
                </button>
              </div>
            </div>

            {/* Decision History Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Decision</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loadingDecisions ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : decisionHistory.decisions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No decision history yet
                      </td>
                    </tr>
                  ) : (
                    decisionHistory.decisions.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{d.description || 'Unknown'}</p>
                          {d.rejection_reason && (
                            <p className="text-xs text-red-500">{getRejectionReasonLabel(d.rejection_reason)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            d.decision === 'accepted'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {d.decision}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {d.final_classification_name || d.suggested_classification_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {d.modified_amount ? (
                            <span>
                              <span className="line-through text-gray-400">${parseFloat(d.original_amount).toFixed(2)}</span>
                              {' → '}
                              <span className="font-medium">${parseFloat(d.modified_amount).toFixed(2)}</span>
                            </span>
                          ) : (
                            <span>${parseFloat(d.original_amount || 0).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {decisionHistory.total > 20 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {decisionPage * 20 + 1} - {Math.min((decisionPage + 1) * 20, decisionHistory.total)} of {decisionHistory.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDecisionPage(p => Math.max(0, p - 1))}
                    disabled={decisionPage === 0}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setDecisionPage(p => p + 1)}
                    disabled={(decisionPage + 1) * 20 >= decisionHistory.total}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Learning Context Modal */}
      {showLearningContext && learningContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold">AI Learning Context</h3>
              </div>
              <button
                onClick={() => setShowLearningContext(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-600">
                This is what the AI has learned from your decisions. It uses this information to improve future suggestions.
              </p>

              {/* Stats Summary */}
              {learningContext.stats && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">Overall Performance</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-purple-600">Total Reviewed</p>
                      <p className="font-bold text-purple-900">{learningContext.stats.total}</p>
                    </div>
                    <div>
                      <p className="text-purple-600">Accepted</p>
                      <p className="font-bold text-purple-900">{learningContext.stats.accepted}</p>
                    </div>
                    <div>
                      <p className="text-purple-600">Rejected</p>
                      <p className="font-bold text-purple-900">{learningContext.stats.rejected}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejected Patterns */}
              {learningContext.rejected_patterns?.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-2">Rejected Patterns (Will Not Suggest Again)</h4>
                  <div className="bg-red-50 rounded-lg p-4 space-y-2">
                    {learningContext.rejected_patterns.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-red-800">"{p.description}"</span>
                        <span className="text-red-600">
                          {getRejectionReasonLabel(p.rejection_reason)} ({p.rejection_count}x)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Classification Corrections */}
              {learningContext.classification_corrections?.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-700 mb-2">Classification Corrections</h4>
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    {learningContext.classification_corrections.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-blue-800">"{c.description}"</span>
                        <span className="text-blue-600">
                          <span className="line-through">{c.suggested_classification_name}</span>
                          {' → '}
                          <span className="font-medium">{c.final_classification_name}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Adjustments */}
              {learningContext.amount_adjustments?.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-700 mb-2">Amount Adjustments</h4>
                  <div className="bg-green-50 rounded-lg p-4 space-y-2">
                    {learningContext.amount_adjustments.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-green-800">"{a.description}"</span>
                        <span className="text-green-600">
                          <span className="line-through">${parseFloat(a.avg_suggested_amount).toFixed(2)}</span>
                          {' → '}
                          <span className="font-medium">${parseFloat(a.avg_final_amount).toFixed(2)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {(!learningContext.rejected_patterns?.length &&
                !learningContext.classification_corrections?.length &&
                !learningContext.amount_adjustments?.length) && (
                <div className="text-center text-gray-500 py-8">
                  <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No learning data yet. Start reviewing AI suggestions to build the learning context.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowLearningContext(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
