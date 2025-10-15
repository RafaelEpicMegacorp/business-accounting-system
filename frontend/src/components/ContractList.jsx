import React, { useState } from 'react';
import { Edit2, Trash2, Calendar, DollarSign, FileSpreadsheet } from 'lucide-react';
import contractService from '../services/contractService';

function ContractList({ contracts, onEdit, onDelete }) {
  const [generating, setGenerating] = useState(null);
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (endDate) => {
    if (!endDate) return false;
    const end = new Date(endDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const handleGenerateEntries = async (contract) => {
    if (!window.confirm(`Generate income entries for ${contract.client_name}?\n\nThis will create entries for all payment dates in the contract period.`)) {
      return;
    }

    try {
      setGenerating(contract.id);
      const result = await contractService.generateEntries(contract.id);
      alert(`Successfully generated ${result.entriesGenerated} income entries for ${contract.client_name}`);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Failed to generate entries:', error);
      alert('Failed to generate entries. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Client</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
            <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
            <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Payment Day</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Start Date</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">End Date</th>
            <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Status</th>
            <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contracts.length === 0 ? (
            <tr>
              <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                No contracts found. Add your first client contract to start tracking recurring revenue.
              </td>
            </tr>
          ) : (
            contracts.map((contract) => (
              <tr key={contract.id} className="border-t border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {contract.client_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                  {contract.contract_type}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                  ${parseFloat(contract.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-700">
                  {contract.payment_day ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={14} />
                      {contract.payment_day}
                    </span>
                  ) : (
                    'N/A'
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatDate(contract.start_date)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    {formatDate(contract.end_date)}
                    {isExpiringSoon(contract.end_date) && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                        Expiring Soon
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(contract.status)}`}>
                    {contract.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleGenerateEntries(contract)}
                      disabled={generating === contract.id}
                      className="text-green-600 hover:text-green-800 disabled:opacity-50"
                      title="Generate income entries"
                    >
                      <FileSpreadsheet size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(contract)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit contract"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(contract.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete contract"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {contracts.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <DollarSign size={18} />
            <span className="font-medium">Monthly Recurring Revenue:</span>
            <span className="text-lg font-bold">
              ${contracts
                .filter(c => c.status === 'active' && c.contract_type === 'monthly')
                .reduce((sum, c) => sum + parseFloat(c.amount), 0)
                .toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContractList;
