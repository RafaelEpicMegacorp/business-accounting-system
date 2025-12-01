const pool = require('../config/database');

const PositionModel = {
  // Get all active positions
  async getAll() {
    const result = await pool.query(
      'SELECT * FROM positions WHERE is_active = true ORDER BY display_order ASC'
    );
    return result.rows;
  },

  // Get position by ID
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM positions WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Get employee counts by position
  async getEmployeeCounts() {
    const result = await pool.query(`
      SELECT
        p.id,
        p.name,
        COUNT(e.id) FILTER (WHERE e.is_active = true) as active_count,
        COUNT(e.id) as total_count
      FROM positions p
      LEFT JOIN employees e ON e.position_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name
      ORDER BY p.display_order ASC
    `);
    return result.rows;
  },

  // Create a new position
  async create(data) {
    const { name, description, display_order } = data;
    const result = await pool.query(
      `INSERT INTO positions (name, description, display_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, display_order || 0]
    );
    return result.rows[0];
  },

  // Update a position
  async update(id, data) {
    const { name, description, display_order, is_active } = data;
    const result = await pool.query(
      `UPDATE positions
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           display_order = COALESCE($3, display_order),
           is_active = COALESCE($4, is_active)
       WHERE id = $5
       RETURNING *`,
      [name, description, display_order, is_active, id]
    );
    return result.rows[0];
  },

  // Soft delete a position (set is_active = false)
  async delete(id) {
    const result = await pool.query(
      'UPDATE positions SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }
};

module.exports = PositionModel;
