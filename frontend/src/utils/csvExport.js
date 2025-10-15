/**
 * CSV Export Utility
 * Handles exporting data to CSV format with proper escaping and formatting
 */

/**
 * Escape CSV field value
 * Handles commas, quotes, and newlines
 */
const escapeCSVField = (field) => {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
};

/**
 * Convert array of objects to CSV string
 */
const arrayToCSV = (data, headers) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Create header row
  const headerRow = headers.map(h => escapeCSVField(h.label)).join(',');

  // Create data rows
  const dataRows = data.map(item => {
    return headers.map(h => escapeCSVField(item[h.key])).join(',');
  }).join('\n');

  // Combine with UTF-8 BOM for Excel compatibility
  return '\uFEFF' + headerRow + '\n' + dataRows;
};

/**
 * Trigger browser download of CSV file
 */
const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL object
  URL.revokeObjectURL(url);
};

/**
 * Export entries to CSV
 */
export const exportEntriesToCSV = (entries) => {
  const headers = [
    { key: 'entry_date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'detail', label: 'Detail' },
    { key: 'base_amount', label: 'Base Amount' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
    { key: 'employee_name', label: 'Employee' }
  ];

  // Format entries data
  const formattedData = entries.map(entry => ({
    ...entry,
    entry_date: new Date(entry.entry_date).toLocaleDateString(),
    type: entry.type.charAt(0).toUpperCase() + entry.type.slice(1),
    status: entry.status.charAt(0).toUpperCase() + entry.status.slice(1),
    base_amount: parseFloat(entry.base_amount).toFixed(2),
    total: parseFloat(entry.total).toFixed(2),
    employee_name: entry.employee_name || ''
  }));

  const csvContent = arrayToCSV(formattedData, headers);
  const filename = `accounting-entries-${new Date().toISOString().split('T')[0]}.csv`;

  downloadCSV(csvContent, filename);
};

/**
 * Export employees to CSV
 */
export const exportEmployeesToCSV = (employees) => {
  const headers = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'pay_type', label: 'Pay Type' },
    { key: 'pay_rate', label: 'Pay Rate' },
    { key: 'pay_multiplier', label: 'Pay Multiplier' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'termination_date', label: 'Termination Date' },
    { key: 'is_active', label: 'Status' }
  ];

  // Format employees data
  const formattedData = employees.map(emp => ({
    ...emp,
    pay_type: emp.pay_type.charAt(0).toUpperCase() + emp.pay_type.slice(1),
    pay_rate: parseFloat(emp.pay_rate).toFixed(2),
    pay_multiplier: parseFloat(emp.pay_multiplier).toFixed(2),
    start_date: new Date(emp.start_date).toLocaleDateString(),
    termination_date: emp.termination_date ? new Date(emp.termination_date).toLocaleDateString() : '',
    is_active: emp.is_active ? 'Active' : 'Terminated'
  }));

  const csvContent = arrayToCSV(formattedData, headers);
  const filename = `accounting-employees-${new Date().toISOString().split('T')[0]}.csv`;

  downloadCSV(csvContent, filename);
};

/**
 * Export contracts to CSV
 */
export const exportContractsToCSV = (contracts) => {
  const headers = [
    { key: 'client_name', label: 'Client Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'contract_type', label: 'Contract Type' },
    { key: 'payment_day', label: 'Payment Day' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'status', label: 'Status' },
    { key: 'last_generated_date', label: 'Last Generated' }
  ];

  // Format contracts data
  const formattedData = contracts.map(contract => ({
    ...contract,
    amount: parseFloat(contract.amount).toFixed(2),
    contract_type: contract.contract_type.charAt(0).toUpperCase() + contract.contract_type.slice(1),
    payment_day: contract.payment_day || 'N/A',
    start_date: new Date(contract.start_date).toLocaleDateString(),
    end_date: contract.end_date ? new Date(contract.end_date).toLocaleDateString() : '',
    status: contract.status.charAt(0).toUpperCase() + contract.status.slice(1),
    last_generated_date: contract.last_generated_date ? new Date(contract.last_generated_date).toLocaleDateString() : 'Never'
  }));

  const csvContent = arrayToCSV(formattedData, headers);
  const filename = `accounting-contracts-${new Date().toISOString().split('T')[0]}.csv`;

  downloadCSV(csvContent, filename);
};
