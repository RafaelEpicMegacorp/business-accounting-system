import React, { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText, Loader } from 'lucide-react';
import api from '../services/api';

export default function WiseImport({ onClose, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError(null);
        setResult(null);
      } else {
        setError('Please select a CSV file');
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append('csvFile', selectedFile);

      const response = await api.post('/wise/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResult(response.data);

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Import error:', err);

      // Get detailed error information from backend
      const errorData = err.response?.data || {};
      const errorMessage = errorData.error || err.message || 'Failed to import CSV file';
      const errorDetails = errorData.details;

      // Combine error message and details
      let fullError = errorMessage;
      if (errorDetails && errorDetails !== errorMessage) {
        fullError += '\n\n' + errorDetails;
      }

      setError(fullError);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Import Wise Transactions</h2>
            <p className="text-sm text-gray-600 mt-1">Upload your Wise transaction history CSV file</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">How to export from Wise:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to Wise.com → Account → Statements</li>
              <li>Select date range</li>
              <li>Click "Export" → Choose "CSV" format</li>
              <li>Upload the downloaded file below</li>
            </ol>
          </div>

          {/* File Upload */}
          {!result && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center justify-center px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <div className="text-center">
                    <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                    <span className="text-sm text-gray-600">
                      {selectedFile ? selectedFile.name : 'Click to select CSV file'}
                    </span>
                    {selectedFile && (
                      <span className="block text-xs text-green-600 mt-1">
                        ✓ File selected
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-900">Import Failed</h4>
                <div className="text-sm text-red-700 mt-2 whitespace-pre-line">
                  {error}
                </div>
                <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                  <strong>Troubleshooting:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Make sure you're uploading the correct Wise CSV export</li>
                    <li>Check that your session hasn't expired (try logging out and back in)</li>
                    <li>Verify the CSV file isn't corrupted or empty</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="mb-6 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-green-900">Import Successful!</h4>
                  <p className="text-sm text-green-700 mt-1">{result.message}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">{result.summary?.imported || 0}</div>
                  <div className="text-sm text-blue-700">Imported</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{result.summary?.skipped || 0}</div>
                  <div className="text-sm text-gray-700">Skipped</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-900">{result.summary?.errors || 0}</div>
                  <div className="text-sm text-red-700">Errors</div>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-yellow-900 mb-2">
                    Errors ({result.errors.length})
                  </h4>
                  <div className="max-h-40 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="text-xs text-yellow-800 mb-1">
                        Line {err.line}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            {result ? (
              <>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Import Another
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Import CSV
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-6 py-4 bg-gray-50 border-t text-xs text-gray-600">
          <p><strong>Note:</strong> Duplicate transactions (same Wise ID) will be automatically skipped. Your existing entries are safe.</p>
        </div>
      </div>
    </div>
  );
}
