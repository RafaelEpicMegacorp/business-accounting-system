import React, { useState, useEffect } from 'react';
import { Settings, Key, Cpu, Check, X, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';
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

  useEffect(() => {
    loadConfig();
  }, []);

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
    </div>
  );
}
