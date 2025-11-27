const pool = require('../config/database');

const projectModel = {
  /**
   * Get all projects with employee counts
   */
  async getAll(status = null) {
    let query = `
      SELECT
        p.*,
        COUNT(DISTINCT ep.employee_id) FILTER (WHERE ep.removed_date IS NULL AND e.is_active = true) as active_employees,
        COUNT(DISTINCT ep.employee_id) as total_employees
      FROM projects p
      LEFT JOIN employee_projects ep ON p.id = ep.project_id
      LEFT JOIN employees e ON ep.employee_id = e.id
    `;

    const params = [];
    if (status !== null && status !== 'all') {
      query += ' WHERE p.status = $1';
      params.push(status);
    }

    query += ' GROUP BY p.id ORDER BY p.name ASC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Get project by ID with employee count
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT
        p.*,
        COUNT(DISTINCT ep.employee_id) FILTER (WHERE ep.removed_date IS NULL AND e.is_active = true) as active_employees
       FROM projects p
       LEFT JOIN employee_projects ep ON p.id = ep.project_id
       LEFT JOIN employees e ON ep.employee_id = e.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Get project with detailed employee information
   */
  async getWithEmployees(id) {
    const project = await this.getById(id);
    if (!project) return null;

    const employees = await pool.query(
      `SELECT
        e.id, e.name, e.email, e.position, e.pay_type as "payType",
        e.pay_rate as "payRate", e.pay_multiplier as "payMultiplier",
        e.is_active as "isActive",
        ep.assigned_date as "assignedDate", ep.removed_date as "removedDate",
        ep.is_primary as "isPrimary", ep.role,
        ep.allocation_percentage as "allocationPercentage"
       FROM employees e
       INNER JOIN employee_projects ep ON e.id = ep.employee_id
       WHERE ep.project_id = $1
       ORDER BY ep.is_primary DESC, e.name ASC`,
      [id]
    );

    return {
      ...project,
      employees: employees.rows
    };
  },

  /**
   * Create new project
   */
  async create(project) {
    const { name, description, status, color, clientName, startDate, endDate, budget } = project;
    const result = await pool.query(
      `INSERT INTO projects (name, description, status, color, client_name, start_date, end_date, budget)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        description || null,
        status || 'active',
        color || '#3B82F6',
        clientName || null,
        startDate || null,
        endDate || null,
        budget || null
      ]
    );
    return result.rows[0];
  },

  /**
   * Update existing project
   */
  async update(id, project) {
    const { name, description, status, color, clientName, startDate, endDate, budget } = project;
    const result = await pool.query(
      `UPDATE projects
       SET name = $1, description = $2, status = $3, color = $4,
           client_name = $5, start_date = $6, end_date = $7, budget = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, description, status, color, clientName, startDate, endDate, budget, id]
    );
    return result.rows[0];
  },

  /**
   * Delete project (hard delete)
   */
  async delete(id) {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },

  /**
   * Archive project (soft delete via status change)
   */
  async archive(id) {
    const result = await pool.query(
      `UPDATE projects
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Assign employee to project
   */
  async assignEmployee(projectId, employeeId, data = {}) {
    const { isPrimary, role, allocationPercentage, assignedDate } = data;

    const result = await pool.query(
      `INSERT INTO employee_projects (project_id, employee_id, is_primary, role, allocation_percentage, assigned_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_id, project_id)
       DO UPDATE SET
         is_primary = EXCLUDED.is_primary,
         role = EXCLUDED.role,
         allocation_percentage = EXCLUDED.allocation_percentage,
         removed_date = NULL
       RETURNING *`,
      [
        projectId,
        employeeId,
        isPrimary || false,
        role || null,
        allocationPercentage || 100.00,
        assignedDate || new Date()
      ]
    );
    return result.rows[0];
  },

  /**
   * Remove employee from project (soft delete)
   */
  async removeEmployee(projectId, employeeId) {
    const result = await pool.query(
      `UPDATE employee_projects
       SET removed_date = CURRENT_DATE
       WHERE project_id = $1 AND employee_id = $2 AND removed_date IS NULL
       RETURNING *`,
      [projectId, employeeId]
    );
    return result.rows[0];
  },

  /**
   * Get project statistics
   */
  async getStats() {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE status = 'active') as active_projects,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_projects,
        COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold_projects,
        COUNT(*) FILTER (WHERE status = 'archived') as archived_projects
      FROM projects
    `);
    return result.rows[0];
  },

  /**
   * Check if project name is unique (for validation)
   */
  async isNameUnique(name, excludeId = null) {
    const query = excludeId
      ? 'SELECT id FROM projects WHERE name = $1 AND id != $2'
      : 'SELECT id FROM projects WHERE name = $1';
    const params = excludeId ? [name, excludeId] : [name];

    const result = await pool.query(query, params);
    return result.rows.length === 0;
  }
};

module.exports = projectModel;
