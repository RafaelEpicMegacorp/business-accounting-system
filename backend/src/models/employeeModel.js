const pool = require('../config/database');

const EmployeeModel = {
  // Get all employees (with optional filter for active/terminated)
  async getAll(isActive = null) {
    let query = 'SELECT * FROM employees';
    const params = [];

    if (isActive !== null) {
      query += ' WHERE is_active = $1';
      params.push(isActive);
    }

    query += ' ORDER BY is_active DESC, name ASC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get employee by ID
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Create new employee
  async create(employee) {
    const { name, email, payType, payRate, payMultiplier, startDate, position } = employee;
    const result = await pool.query(
      `INSERT INTO employees (name, email, pay_type, pay_rate, pay_multiplier, start_date, position, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [name, email || null, payType, payRate, payMultiplier || 1.0, startDate || new Date(), position || null]
    );
    return result.rows[0];
  },

  // Update employee
  async update(id, employee) {
    const { name, email, payType, payRate, payMultiplier, startDate, position } = employee;
    const result = await pool.query(
      `UPDATE employees
       SET name = $1, email = $2, pay_type = $3, pay_rate = $4, pay_multiplier = $5, start_date = $6, position = $7
       WHERE id = $8
       RETURNING *`,
      [name, email || null, payType, payRate, payMultiplier || 1.0, startDate, position || null, id]
    );
    return result.rows[0];
  },

  // Terminate employee (soft delete)
  async terminate(id, terminationDate) {
    const result = await pool.query(
      `UPDATE employees
       SET termination_date = $1, is_active = false
       WHERE id = $2
       RETURNING *`,
      [terminationDate || new Date(), id]
    );
    return result.rows[0];
  },

  // Reactivate employee
  async reactivate(id) {
    const result = await pool.query(
      `UPDATE employees
       SET termination_date = NULL, is_active = true
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  // Delete employee (hard delete - only if no linked entries)
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Get employee with entry statistics
  async getWithStats(id) {
    const result = await pool.query(
      `SELECT
        e.*,
        COUNT(en.id) as total_entries,
        SUM(CASE WHEN en.status = 'completed' THEN en.total ELSE 0 END) as total_paid,
        MAX(en.entry_date) as last_payment_date
       FROM employees e
       LEFT JOIN entries en ON e.id = en.employee_id
       WHERE e.id = $1
       GROUP BY e.id`,
      [id]
    );
    return result.rows[0];
  },

  // Get all employees with entry counts
  async getAllWithStats(isActive = null) {
    let query = `
      SELECT
        e.*,
        COUNT(en.id) as total_entries,
        SUM(CASE WHEN en.status = 'completed' THEN en.total ELSE 0 END) as total_paid,
        MAX(en.entry_date) as last_payment_date
      FROM employees e
      LEFT JOIN entries en ON e.id = en.employee_id
    `;
    const params = [];

    if (isActive !== null) {
      query += ' WHERE e.is_active = $1';
      params.push(isActive);
    }

    query += ' GROUP BY e.id ORDER BY e.is_active DESC, e.name ASC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Calculate severance pay for employee termination
  async calculateSeverance(id, terminationDate) {
    const employee = await this.getById(id);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const startDate = new Date(employee.start_date);
    const endDate = new Date(terminationDate);
    const payRate = parseFloat(employee.pay_rate);
    const multiplier = parseFloat(employee.pay_multiplier);

    // Calculate days worked
    const daysWorked = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    let baseSeverance = 0;
    let periodDescription = '';

    if (employee.pay_type === 'monthly') {
      // Calculate which month(s) the termination falls in
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      // Get first day of termination month
      const termMonthStart = new Date(endYear, endMonth, 1);

      // If started before this month, count full previous months
      let fullMonths = 0;
      if (startDate < termMonthStart) {
        fullMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
        baseSeverance += payRate * fullMonths;
      }

      // Calculate partial month for termination month
      const daysInTermMonth = new Date(endYear, endMonth + 1, 0).getDate();

      // Fix: Check if employee started in same month as termination
      let dayWorkedInTermMonth;
      if (startYear === endYear && startMonth === endMonth) {
        // Started in same month: calculate actual days worked
        dayWorkedInTermMonth = endDate.getDate() - startDate.getDate() + 1;
      } else {
        // Started in previous month(s): count from day 1 to termination day
        dayWorkedInTermMonth = endDate.getDate();
      }

      const partialMonthRatio = dayWorkedInTermMonth / daysInTermMonth;
      baseSeverance += payRate * partialMonthRatio;

      periodDescription = fullMonths > 0
        ? `${fullMonths} full month(s) + ${dayWorkedInTermMonth} days`
        : `${dayWorkedInTermMonth} days of ${daysInTermMonth}`;

    } else if (employee.pay_type === 'weekly') {
      const fullWeeks = Math.floor(daysWorked / 7);
      const remainingDays = daysWorked % 7;
      baseSeverance = (payRate * fullWeeks) + (payRate / 7 * remainingDays);
      periodDescription = fullWeeks > 0
        ? `${fullWeeks} week(s) + ${remainingDays} day(s)`
        : `${remainingDays} day(s)`;

    } else if (employee.pay_type === 'hourly') {
      // Assume 8 hours per day
      const hoursWorked = daysWorked * 8;
      baseSeverance = payRate * hoursWorked;
      periodDescription = `${daysWorked} day(s) × 8 hours = ${hoursWorked} hours`;
    }

    const totalSeverance = baseSeverance * multiplier;

    // Calculate payment due date based on pay type
    let paymentDueDate;
    if (employee.pay_type === 'monthly') {
      // Payment due at end of termination month
      const termYear = endDate.getFullYear();
      const termMonth = endDate.getMonth();
      paymentDueDate = new Date(termYear, termMonth + 1, 0); // Last day of month
    } else if (employee.pay_type === 'weekly') {
      // Payment due at end of week (Sunday)
      const dayOfWeek = endDate.getDay(); // 0 = Sunday, 6 = Saturday
      const daysUntilSunday = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
      paymentDueDate = new Date(endDate);
      paymentDueDate.setDate(endDate.getDate() + daysUntilSunday);
    } else {
      // Hourly: payment due on termination date
      paymentDueDate = endDate;
    }

    return {
      employee_id: employee.id,
      employee_name: employee.name,
      pay_type: employee.pay_type,
      pay_rate: payRate,
      pay_multiplier: multiplier,
      start_date: startDate.toISOString().split('T')[0],
      termination_date: endDate.toISOString().split('T')[0],
      payment_due_date: paymentDueDate.toISOString().split('T')[0],
      days_worked: daysWorked,
      period_description: periodDescription,
      base_severance: parseFloat(baseSeverance.toFixed(2)),
      total_severance: parseFloat(totalSeverance.toFixed(2))
    };
  },

  // Calculate severance with override values (for preview without saving)
  async calculateSeveranceWithOverrides(id, terminationDate, overrides = {}) {
    const employee = await this.getById(id);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Use overrides if provided, otherwise use employee data from DB
    const payType = overrides.payType || employee.pay_type;
    const payRate = parseFloat(overrides.payRate || employee.pay_rate);
    const multiplier = parseFloat(overrides.payMultiplier || employee.pay_multiplier);
    const startDate = new Date(overrides.startDate || employee.start_date);
    const endDate = new Date(terminationDate);

    // Calculate days worked
    const daysWorked = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    let baseSeverance = 0;
    let periodDescription = '';

    if (payType === 'monthly') {
      // Calculate which month(s) the termination falls in
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      // Get first day of termination month
      const termMonthStart = new Date(endYear, endMonth, 1);

      // If started before this month, count full previous months
      let fullMonths = 0;
      if (startDate < termMonthStart) {
        fullMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
        baseSeverance += payRate * fullMonths;
      }

      // Calculate partial month for termination month
      const daysInTermMonth = new Date(endYear, endMonth + 1, 0).getDate();

      // Fix: Check if employee started in same month as termination
      let dayWorkedInTermMonth;
      if (startYear === endYear && startMonth === endMonth) {
        // Started in same month: calculate actual days worked
        dayWorkedInTermMonth = endDate.getDate() - startDate.getDate() + 1;
      } else {
        // Started in previous month(s): count from day 1 to termination day
        dayWorkedInTermMonth = endDate.getDate();
      }

      const partialMonthRatio = dayWorkedInTermMonth / daysInTermMonth;
      baseSeverance += payRate * partialMonthRatio;

      periodDescription = fullMonths > 0
        ? `${fullMonths} full month(s) + ${dayWorkedInTermMonth} days`
        : `${dayWorkedInTermMonth} days of ${daysInTermMonth}`;

    } else if (payType === 'weekly') {
      const fullWeeks = Math.floor(daysWorked / 7);
      const remainingDays = daysWorked % 7;
      baseSeverance = (payRate * fullWeeks) + (payRate / 7 * remainingDays);
      periodDescription = fullWeeks > 0
        ? `${fullWeeks} week(s) + ${remainingDays} day(s)`
        : `${remainingDays} day(s)`;

    } else if (payType === 'hourly') {
      // Assume 8 hours per day
      const hoursWorked = daysWorked * 8;
      baseSeverance = payRate * hoursWorked;
      periodDescription = `${daysWorked} day(s) × 8 hours = ${hoursWorked} hours`;
    }

    const totalSeverance = baseSeverance * multiplier;

    return {
      employee_id: employee.id,
      employee_name: employee.name,
      pay_type: payType,
      pay_rate: payRate,
      pay_multiplier: multiplier,
      start_date: startDate.toISOString().split('T')[0],
      termination_date: endDate.toISOString().split('T')[0],
      days_worked: daysWorked,
      period_description: periodDescription,
      base_severance: parseFloat(baseSeverance.toFixed(2)),
      total_severance: parseFloat(totalSeverance.toFixed(2))
    };
  },

  // Bulk delete employees
  async bulkDelete(ids) {
    const failed = [];
    let affected = 0;

    for (const id of ids) {
      try {
        const result = await pool.query(
          'DELETE FROM employees WHERE id = $1 RETURNING id, name',
          [id]
        );

        if (result.rows.length > 0) {
          affected++;
        } else {
          failed.push({ id, reason: 'Employee not found' });
        }
      } catch (error) {
        if (error.code === '23503') {
          failed.push({ id, reason: 'Employee has existing entries' });
        } else {
          failed.push({ id, reason: error.message });
        }
      }
    }

    return { affected, failed };
  },

  // Bulk terminate employees
  async bulkTerminate(ids, terminationDate) {
    const failed = [];
    let affected = 0;

    for (const id of ids) {
      try {
        const result = await pool.query(
          'UPDATE employees SET is_active = false, termination_date = $1 WHERE id = $2 AND is_active = true RETURNING id',
          [terminationDate, id]
        );

        if (result.rows.length > 0) {
          affected++;
        } else {
          failed.push({ id, reason: 'Employee not found or already terminated' });
        }
      } catch (error) {
        failed.push({ id, reason: error.message });
      }
    }

    return { affected, failed };
  },

  // Bulk reactivate employees
  async bulkReactivate(ids) {
    const failed = [];
    let affected = 0;

    for (const id of ids) {
      try {
        const result = await pool.query(
          'UPDATE employees SET is_active = true, termination_date = NULL WHERE id = $1 AND is_active = false RETURNING id',
          [id]
        );

        if (result.rows.length > 0) {
          affected++;
        } else {
          failed.push({ id, reason: 'Employee not found or already active' });
        }
      } catch (error) {
        failed.push({ id, reason: error.message });
      }
    }

    return { affected, failed };
  },

  // Get all employees with their primary project
  async getAllWithProjects(isActive = null) {
    let query = `
      SELECT
        e.*,
        COUNT(en.id) as total_entries,
        SUM(CASE WHEN en.status = 'completed' THEN en.total ELSE 0 END) as total_paid,
        MAX(en.entry_date) as last_payment_date,
        p.id as primary_project_id,
        p.name as primary_project_name,
        p.color as primary_project_color
      FROM employees e
      LEFT JOIN entries en ON e.id = en.employee_id
      LEFT JOIN employee_projects ep ON e.id = ep.employee_id AND ep.is_primary = true AND ep.removed_date IS NULL
      LEFT JOIN projects p ON ep.project_id = p.id
    `;

    const params = [];
    if (isActive !== null) {
      query += ' WHERE e.is_active = $1';
      params.push(isActive);
    }

    query += ' GROUP BY e.id, p.id, p.name, p.color ORDER BY e.is_active DESC, e.name ASC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get employee with all their projects
  async getWithProjects(id) {
    const employee = await this.getById(id);
    if (!employee) return null;

    const projects = await pool.query(
      `SELECT
        p.id, p.name, p.description, p.status, p.color,
        ep.assigned_date as "assignedDate", ep.removed_date as "removedDate",
        ep.is_primary as "isPrimary", ep.role,
        ep.allocation_percentage as "allocationPercentage"
       FROM projects p
       INNER JOIN employee_projects ep ON p.id = ep.project_id
       WHERE ep.employee_id = $1 AND ep.removed_date IS NULL
       ORDER BY ep.is_primary DESC, p.name ASC`,
      [id]
    );

    return {
      ...employee,
      projects: projects.rows
    };
  }
};

module.exports = EmployeeModel;
