const pool = require('../config/database');

const ContractModel = {
  // Get all contracts
  async getAll() {
    const result = await pool.query(
      'SELECT * FROM contracts ORDER BY status ASC, start_date DESC'
    );
    return result.rows;
  },

  // Get active contracts only
  async getActive() {
    const result = await pool.query(
      `SELECT * FROM contracts
       WHERE status = 'active'
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       ORDER BY client_name ASC`
    );
    return result.rows;
  },

  // Get contract by ID
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM contracts WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Create new contract
  async create(contract) {
    const { clientName, contractType, amount, paymentDay, startDate, endDate, notes } = contract;
    const result = await pool.query(
      `INSERT INTO contracts (client_name, contract_type, amount, payment_day, start_date, end_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING *`,
      [clientName, contractType, amount, paymentDay || null, startDate, endDate || null, notes || '']
    );
    return result.rows[0];
  },

  // Update contract
  async update(id, contract) {
    const { clientName, contractType, amount, paymentDay, startDate, endDate, status, notes } = contract;
    const result = await pool.query(
      `UPDATE contracts
       SET client_name = $1, contract_type = $2, amount = $3, payment_day = $4,
           start_date = $5, end_date = $6, status = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [clientName, contractType, amount, paymentDay || null, startDate, endDate || null, status, notes || '', id]
    );
    return result.rows[0];
  },

  // Delete contract
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM contracts WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Calculate total monthly recurring revenue
  async getRecurringRevenue() {
    const result = await pool.query(
      `SELECT SUM(amount) as total_monthly_revenue
       FROM contracts
       WHERE status = 'active'
       AND contract_type = 'monthly'
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
    );
    return parseFloat(result.rows[0].total_monthly_revenue || 0);
  },

  // Get pending contract payments for current month
  async getPendingContractPayments() {
    const today = new Date();
    const currentDay = today.getDate();

    const result = await pool.query(
      `SELECT * FROM contracts
       WHERE status = 'active'
       AND contract_type = 'monthly'
       AND payment_day >= $1
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       ORDER BY payment_day ASC`,
      [currentDay]
    );

    return result.rows.map(contract => ({
      id: contract.id,
      client_name: contract.client_name,
      amount: parseFloat(contract.amount),
      payment_day: contract.payment_day,
      payment_date: new Date(today.getFullYear(), today.getMonth(), contract.payment_day).toISOString().split('T')[0]
    }));
  },

  // Generate income entries for a contract
  async generateEntries(contractId) {
    // Get contract details
    const contractResult = await pool.query(
      'SELECT * FROM contracts WHERE id = $1',
      [contractId]
    );

    if (contractResult.rows.length === 0) {
      throw new Error('Contract not found');
    }

    const contract = contractResult.rows[0];

    // Only generate entries for monthly and yearly contracts
    if (contract.contract_type === 'one-time') {
      // For one-time contracts, generate a single entry on start_date
      const today = new Date();
      const startDate = new Date(contract.start_date);
      const status = startDate <= today ? 'completed' : 'pending';

      await pool.query(
        `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, contract_id)
         VALUES ('income', 'Contract', $1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          contract.client_name,
          `One-time payment - ${contract.notes || ''}`,
          contract.amount,
          contract.amount,
          contract.start_date,
          status,
          contractId
        ]
      );

      return { generated: 1 };
    }

    // For monthly/yearly contracts, generate entries for each period
    const startDate = new Date(contract.start_date);
    const endDate = contract.end_date ? new Date(contract.end_date) : new Date(startDate.getFullYear() + 10, startDate.getMonth(), startDate.getDate());
    const today = new Date();

    const paymentDates = [];
    let currentDate = new Date(startDate);

    // Generate payment dates based on contract type
    if (contract.contract_type === 'monthly') {
      // Generate monthly payments on payment_day
      while (currentDate <= endDate) {
        const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), contract.payment_day || 1);

        // Only add if within contract period
        if (paymentDate >= startDate && paymentDate <= endDate) {
          paymentDates.push(paymentDate);
        }

        // Move to next month
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      }
    } else if (contract.contract_type === 'yearly') {
      // Generate yearly payments on payment_day of start month
      while (currentDate <= endDate) {
        const paymentDate = new Date(currentDate.getFullYear(), startDate.getMonth(), contract.payment_day || startDate.getDate());

        if (paymentDate >= startDate && paymentDate <= endDate) {
          paymentDates.push(paymentDate);
        }

        // Move to next year
        currentDate = new Date(currentDate.getFullYear() + 1, startDate.getMonth(), 1);
      }
    }

    // Delete existing entries for this contract (to regenerate)
    await pool.query(
      'DELETE FROM entries WHERE contract_id = $1',
      [contractId]
    );

    // Insert new entries
    let generatedCount = 0;
    for (const paymentDate of paymentDates) {
      const status = paymentDate <= today ? 'completed' : 'pending';
      const detail = `${contract.contract_type.charAt(0).toUpperCase() + contract.contract_type.slice(1)} payment - ${contract.notes || ''}`;

      await pool.query(
        `INSERT INTO entries (type, category, description, detail, base_amount, total, entry_date, status, contract_id)
         VALUES ('income', 'Contract', $1, $2, $3, $4, $5, $6, $7)`,
        [
          contract.client_name,
          detail,
          contract.amount,
          contract.amount,
          paymentDate.toISOString().split('T')[0],
          status,
          contractId
        ]
      );
      generatedCount++;
    }

    // Update last_generated_date
    await pool.query(
      'UPDATE contracts SET last_generated_date = CURRENT_DATE WHERE id = $1',
      [contractId]
    );

    return { generated: generatedCount, dates: paymentDates.map(d => d.toISOString().split('T')[0]) };
  }
};

module.exports = ContractModel;
