import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Edit2, Trash2, X } from 'lucide-react';

export default function SalaryCalendar({ entries, onEdit, onDelete, onRefresh }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editFormData, setEditFormData] = useState({
    description: '',
    detail: '',
    baseAmount: '',
    total: '',
    entryDate: '',
    status: 'completed'
  });

  // Helper function to get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const grouped = {};
    entries.forEach(entry => {
      const date = entry.entry_date.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(entry);
    });
    return grouped;
  }, [entries]);

  // Calculate daily totals
  const getDayData = (dateString) => {
    const dayEntries = entriesByDate[dateString] || [];
    const completed = dayEntries.filter(e => e.status === 'completed');
    const pending = dayEntries.filter(e => e.status === 'pending');
    const completedTotal = completed.reduce((sum, e) => sum + parseFloat(e.total), 0);
    const pendingTotal = pending.reduce((sum, e) => sum + parseFloat(e.total), 0);

    return {
      entries: dayEntries,
      count: dayEntries.length,
      completedTotal,
      pendingTotal,
      total: completedTotal + pendingTotal
    };
  };

  // Get calendar grid data
  const calendarDays = useMemo(() => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateString,
        ...getDayData(dateString)
      });
    }

    return days;
  }, [currentDate, entriesByDate]);

  // Calculate weekly totals
  const weeklyTotals = useMemo(() => {
    const weeks = [];
    let currentWeek = [];

    calendarDays.forEach((day, index) => {
      currentWeek.push(day);

      if ((index + 1) % 7 === 0 || index === calendarDays.length - 1) {
        const weekTotal = currentWeek.reduce((sum, d) => {
          return sum + (d ? d.total : 0);
        }, 0);
        const weekCount = currentWeek.reduce((sum, d) => {
          return sum + (d ? d.count : 0);
        }, 0);
        weeks.push({ total: weekTotal, count: weekCount });
        currentWeek = [];
      }
    });

    return weeks;
  }, [calendarDays]);

  // Month navigation
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  // Format currency
  const formatCurrency = (value) => {
    return parseFloat(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Check if date is today
  const isToday = (dateString) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  };

  // Month summary
  const monthSummary = useMemo(() => {
    const allDays = calendarDays.filter(d => d !== null);
    const totalCompleted = allDays.reduce((sum, d) => sum + d.completedTotal, 0);
    const totalPending = allDays.reduce((sum, d) => sum + d.pendingTotal, 0);
    const totalPayments = allDays.reduce((sum, d) => sum + d.count, 0);

    return {
      totalCompleted,
      totalPending,
      total: totalCompleted + totalPending,
      totalPayments
    };
  }, [calendarDays]);

  // Edit modal handlers
  const handleEditClick = (entry) => {
    setEditingEntry(entry);
    setEditFormData({
      description: entry.description || entry.employee_name || '',
      detail: entry.detail || '',
      baseAmount: entry.base_amount.toString(),
      total: entry.total.toString(),
      entryDate: entry.entry_date.split('T')[0],
      status: entry.status || 'completed'
    });
  };

  const handleEditSave = async () => {
    // Validation
    if (!editFormData.description || !editFormData.baseAmount || !editFormData.total) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Import API service
      const { default: entryService } = await import('../services/entryService');

      // Update entry
      await entryService.update(editingEntry.id, {
        type: editingEntry.type,
        category: editingEntry.category,
        description: editFormData.description,
        detail: editFormData.detail,
        baseAmount: parseFloat(editFormData.baseAmount),
        total: parseFloat(editFormData.total),
        entryDate: editFormData.entryDate,
        status: editFormData.status
      });

      // Close modal and refresh
      setEditingEntry(null);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update entry. Please try again.');
    }
  };

  const handleEditCancel = () => {
    setEditingEntry(null);
    setEditFormData({
      description: '',
      detail: '',
      baseAmount: '',
      total: '',
      entryDate: '',
      status: 'completed'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="text-gray-700" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Completed</p>
          <p className="text-2xl font-bold text-green-700">${formatCurrency(monthSummary.totalCompleted)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-600 font-medium">Pending</p>
          <p className="text-2xl font-bold text-yellow-700">${formatCurrency(monthSummary.totalPending)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Total</p>
          <p className="text-2xl font-bold text-blue-700">${formatCurrency(monthSummary.total)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Payments</p>
          <p className="text-2xl font-bold text-gray-700">{monthSummary.totalPayments}</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
          <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">Week</div>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-8 border-b border-gray-200 last:border-b-0">
            {/* Week Summary */}
            <div className="px-4 py-6 bg-gray-50 border-r border-gray-200 flex flex-col items-center justify-center">
              <p className="text-xs text-gray-500 mb-1">Week {weekIndex + 1}</p>
              {weeklyTotals[weekIndex] && weeklyTotals[weekIndex].total > 0 && (
                <>
                  <p className="text-sm font-bold text-gray-900">${formatCurrency(weeklyTotals[weekIndex].total)}</p>
                  <p className="text-xs text-gray-500">{weeklyTotals[weekIndex].count} payments</p>
                </>
              )}
            </div>

            {/* Days in Week */}
            {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`px-2 py-4 min-h-[120px] border-r border-gray-200 last:border-r-0 ${
                  day ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'
                } ${isToday(day?.dateString) ? 'bg-blue-50' : ''}`}
                onClick={() => day && day.count > 0 && setSelectedDay(day)}
              >
                {day && (
                  <>
                    <div className={`text-sm font-medium mb-2 ${
                      isToday(day.dateString) ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {day.day}
                    </div>
                    {day.count > 0 && (
                      <div className="space-y-1">
                        {day.completedTotal > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            ${formatCurrency(day.completedTotal)}
                          </div>
                        )}
                        {day.pendingTotal > 0 && (
                          <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                            ${formatCurrency(day.pendingTotal)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          {day.count} payment{day.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {new Date(selectedDay.dateString + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedDay.count} payment{selectedDay.count !== 1 ? 's' : ''} • Total: ${formatCurrency(selectedDay.total)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Payment List */}
            <div className="p-6">
              <div className="space-y-3">
                {selectedDay.entries.map(entry => (
                  <div
                    key={entry.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">{entry.employee_name || entry.description}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            entry.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {entry.status}
                          </span>
                          {entry.pay_type && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              {entry.pay_type}
                            </span>
                          )}
                        </div>
                        {entry.detail && (
                          <p className="text-sm text-gray-600 mb-2">{entry.detail}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            Base: <span className="font-medium text-gray-900">${formatCurrency(entry.base_amount)}</span>
                          </span>
                          <span className="text-gray-600">
                            Total: <span className="font-medium text-gray-900">${formatCurrency(entry.total)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(entry);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(entry.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Edit Payment
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {editingEntry.employee_name || editingEntry.description}
                </p>
              </div>
              <button
                onClick={handleEditCancel}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Employee Info Display */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {editingEntry.pay_type && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {editingEntry.pay_type}
                      </span>
                    )}
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                      {editingEntry.category}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Payment description"
                  />
                </div>

                {/* Detail */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Details
                  </label>
                  <textarea
                    value={editFormData.detail}
                    onChange={(e) => setEditFormData({ ...editFormData, detail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    placeholder="Optional additional details"
                  />
                </div>

                {/* Base Amount and Total */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 font-medium text-lg">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.baseAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, baseAmount: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 font-medium text-lg">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.total}
                        onChange={(e) => setEditFormData({ ...editFormData, total: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Date and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      value={editFormData.entryDate}
                      onChange={(e) => setEditFormData({ ...editFormData, entryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleEditCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
