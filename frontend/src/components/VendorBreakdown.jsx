import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import dashboardService from '../services/dashboardService';

function VendorBreakdown({ year, month }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadVendorBreakdown();
  }, [year, month]);

  const loadVendorBreakdown = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getVendorBreakdown(year, month);
      setVendors(data);
    } catch (error) {
      console.error('Failed to load vendor breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const displayedVendors = showAll ? vendors : vendors.slice(0, 10);
  const total = vendors.reduce((sum, v) => sum + v.total, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Expenses by Vendor - {monthNames[month - 1]}
          </h3>
        </div>
        <span className="text-sm text-gray-500">{vendors.length} vendors</span>
      </div>

      {vendors.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No vendor data found</p>
      ) : (
        <>
          <div className="space-y-2">
            {displayedVendors.map((vendor, index) => {
              const percentage = total > 0 ? (vendor.total / total * 100) : 0;
              return (
                <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{vendor.vendor}</p>
                      <p className="text-xs text-gray-500">{vendor.transactionCount} transactions</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900 ml-4">
                      ${vendor.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">{percentage.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>

          {vendors.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full py-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              {showAll ? 'Show Less' : `Show All (${vendors.length} vendors)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default VendorBreakdown;
