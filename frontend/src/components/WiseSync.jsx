import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, AlertCircle, TrendingUp, Database, Zap } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const WiseSync = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [balances, setBalances] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, eventsRes] = await Promise.all([
        axios.get(`${API_URL}/api/wise/status`),
        axios.get(`${API_URL}/api/wise/events?limit=20`)
      ]);

      setSyncStatus(statusRes.data.status);
      setEvents(eventsRes.data);
    } catch (err) {
      console.error('Error fetching Wise sync data:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/wise/balances`);
      setBalances(res.data);
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  };

  const processPendingEvents = async () => {
    try {
      setProcessing(true);
      const res = await axios.post(`${API_URL}/api/wise/process-pending`);
      alert(`Processed: ${res.data.processed}, Failed: ${res.data.failed}`);
      await fetchAllData();
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getEventStatusColor = (event) => {
    if (event.error_message) return 'text-red-600';
    if (event.processed) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getEventStatusIcon = (event) => {
    if (event.error_message) return <X className="w-4 h-4" />;
    if (event.processed) return <Check className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  if (loading && !syncStatus) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-gray-600">Loading Wise sync status...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-500" />
          Wise Integration
        </h2>
        <button
          onClick={fetchAllData}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Sync Status Cards */}
      {syncStatus && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Webhook Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Webhook Status</h3>
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Enabled:</span>
                <span className={`font-semibold ${syncStatus.webhook_enabled ? 'text-green-600' : 'text-red-600'}`}>
                  {syncStatus.webhook_enabled ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Profile ID:</span>
                <span className="font-mono text-sm">{syncStatus.profile_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Received:</span>
                <span className="text-sm">{formatDate(syncStatus.last_webhook_received)}</span>
              </div>
            </div>
          </div>

          {/* Event Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Event Stats</h3>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Received:</span>
                <span className="font-semibold text-blue-600">{syncStatus.total_events_received || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processed:</span>
                <span className="font-semibold text-green-600">{syncStatus.total_events_processed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed:</span>
                <span className="font-semibold text-red-600">{syncStatus.total_events_failed || 0}</span>
              </div>
            </div>
          </div>

          {/* Current Balances */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Current Balances</h3>
              <button
                onClick={fetchBalances}
                className="text-blue-500 hover:text-blue-700 text-sm"
              >
                Update
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">USD:</span>
                <span className="font-semibold">${syncStatus.current_balance_usd?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">EUR:</span>
                <span className="font-semibold">€{syncStatus.current_balance_eur?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">GBP:</span>
                <span className="font-semibold">£{syncStatus.current_balance_gbp?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PLN:</span>
                <span className="font-semibold">{syncStatus.current_balance_pln?.toFixed(2) || '0.00'} zł</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Pending Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-blue-800">Manual Processing</h3>
            <p className="text-sm text-blue-600">Process any pending webhook events that haven't been processed yet</p>
          </div>
          <button
            onClick={processPendingEvents}
            disabled={processing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            Process Pending
          </button>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-700">Recent Webhook Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No webhook events yet
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-2 ${getEventStatusColor(event)}`}>
                        {getEventStatusIcon(event)}
                        <span className="text-sm font-medium">
                          {event.error_message ? 'Error' : event.processed ? 'Processed' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.event_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {event.event_id.substring(0, 20)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(event.received_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(event.processed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last Error */}
      {syncStatus?.last_error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">Last Error</h3>
          <p className="text-red-600 text-sm">{syncStatus.last_error}</p>
        </div>
      )}
    </div>
  );
};

export default WiseSync;
