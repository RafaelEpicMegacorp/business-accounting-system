import React, { useState, useEffect } from 'react';
import { TrendingDown } from 'lucide-react';
import dashboardService from '../services/dashboardService';

function TopExpensesList({ year, month }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopExpenses();
  }, [year, month]);

  const loadTopExpenses = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getTopExpenses(year, month, 10);
      setExpenses(data);
    } catch (error) {
      console.error('Failed to load top expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown size={20} className="text-red-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Top 10 Expenses - {monthNames[month - 1]}
        </h3>
      </div>

      {expenses.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No expenses found</p>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense, index) => (
            <div
              key={expense.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-gray-900">{expense.description}</p>
                  <p className="text-xs text-gray-500">
                    {expense.category} - {new Date(expense.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-red-600">
                ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TopExpensesList;
