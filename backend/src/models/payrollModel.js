const pool = require('../config/database');

const payrollModel = {
  /**
   * Get payroll summary with per-project and per-employee breakdowns
   */
  async getSummary() {
    // Get per-project breakdown with costs
    const projectsResult = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.color,
        p.status,
        COUNT(DISTINCT e.id) FILTER (WHERE ep.removed_date IS NULL AND e.is_active = true) as employee_count,
        COALESCE(SUM(
          CASE
            WHEN ep.removed_date IS NULL AND e.is_active = true THEN
              CASE e.pay_type
                WHEN 'monthly' THEN e.pay_rate * e.pay_multiplier * (COALESCE(ep.allocation_percentage, 100) / 100)
                WHEN 'weekly' THEN e.pay_rate * e.pay_multiplier * 4.33 * (COALESCE(ep.allocation_percentage, 100) / 100)
                WHEN 'hourly' THEN e.pay_rate * e.pay_multiplier * 160 * (COALESCE(ep.allocation_percentage, 100) / 100)
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as monthly_cost
      FROM projects p
      LEFT JOIN employee_projects ep ON p.id = ep.project_id
      LEFT JOIN employees e ON ep.employee_id = e.id
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY monthly_cost DESC, p.name ASC
    `);

    // Get per-employee breakdown with their projects
    const employeesResult = await pool.query(`
      SELECT
        e.id,
        e.name,
        e.email,
        e.position,
        e.pay_type,
        e.pay_rate,
        e.pay_multiplier,
        e.start_date,
        e.is_active,
        CASE e.pay_type
          WHEN 'monthly' THEN e.pay_rate * e.pay_multiplier
          WHEN 'weekly' THEN e.pay_rate * e.pay_multiplier * 4.33
          WHEN 'hourly' THEN e.pay_rate * e.pay_multiplier * 160
          ELSE 0
        END as monthly_cost,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'color', p.color,
              'allocation', ep.allocation_percentage,
              'isPrimary', ep.is_primary
            )
          ) FILTER (WHERE p.id IS NOT NULL AND ep.removed_date IS NULL),
          '[]'
        ) as projects
      FROM employees e
      LEFT JOIN employee_projects ep ON e.id = ep.employee_id AND ep.removed_date IS NULL
      LEFT JOIN projects p ON ep.project_id = p.id AND p.status = 'active'
      WHERE e.is_active = true
      GROUP BY e.id
      ORDER BY monthly_cost DESC, e.name ASC
    `);

    // Get terminated employees (for history)
    const terminatedResult = await pool.query(`
      SELECT
        e.id,
        e.name,
        e.position,
        e.pay_type,
        e.pay_rate,
        e.pay_multiplier,
        e.termination_date,
        CASE e.pay_type
          WHEN 'monthly' THEN e.pay_rate * e.pay_multiplier
          WHEN 'weekly' THEN e.pay_rate * e.pay_multiplier * 4.33
          WHEN 'hourly' THEN e.pay_rate * e.pay_multiplier * 160
          ELSE 0
        END as last_monthly_cost,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'color', p.color
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as last_projects
      FROM employees e
      LEFT JOIN employee_projects ep ON e.id = ep.employee_id
      LEFT JOIN projects p ON ep.project_id = p.id
      WHERE e.is_active = false
      GROUP BY e.id
      ORDER BY e.termination_date DESC
    `);

    // Calculate totals
    const totalsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true) as active_employees,
        COUNT(*) FILTER (WHERE is_active = false) as terminated_employees,
        COALESCE(SUM(
          CASE
            WHEN is_active = true THEN
              CASE pay_type
                WHEN 'monthly' THEN pay_rate * pay_multiplier
                WHEN 'weekly' THEN pay_rate * pay_multiplier * 4.33
                WHEN 'hourly' THEN pay_rate * pay_multiplier * 160
                ELSE 0
              END
            ELSE 0
          END
        ), 0) as total_monthly_payroll,
        COALESCE(SUM(CASE WHEN is_active = true AND pay_type = 'monthly' THEN pay_rate * pay_multiplier ELSE 0 END), 0) as monthly_employees_cost,
        COALESCE(SUM(CASE WHEN is_active = true AND pay_type = 'weekly' THEN pay_rate * pay_multiplier * 4.33 ELSE 0 END), 0) as weekly_employees_cost,
        COALESCE(SUM(CASE WHEN is_active = true AND pay_type = 'hourly' THEN pay_rate * pay_multiplier * 160 ELSE 0 END), 0) as hourly_employees_cost
      FROM employees
    `);

    // Count projects with active employees
    const projectCountResult = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as projects_with_employees
      FROM projects p
      INNER JOIN employee_projects ep ON p.id = ep.project_id AND ep.removed_date IS NULL
      INNER JOIN employees e ON ep.employee_id = e.id AND e.is_active = true
      WHERE p.status = 'active'
    `);

    return {
      totals: {
        ...totalsResult.rows[0],
        projects_with_employees: projectCountResult.rows[0].projects_with_employees
      },
      projects: projectsResult.rows,
      employees: employeesResult.rows,
      terminated: terminatedResult.rows
    };
  }
};

module.exports = payrollModel;
