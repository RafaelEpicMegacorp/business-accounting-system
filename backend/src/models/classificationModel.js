const pool = require('../config/database');

const ClassificationModel = {
  /**
   * Get all classifications (flat list)
   */
  async getAll() {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.parent_id,
        c.description,
        c.is_default,
        c.sort_order,
        p.name as parent_name
      FROM expense_classifications c
      LEFT JOIN expense_classifications p ON c.parent_id = p.id
      ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name
    `);
    return result.rows;
  },

  /**
   * Get classifications as hierarchical tree
   */
  async getHierarchy() {
    const all = await this.getAll();

    // Build tree structure
    const parents = all.filter(c => !c.parent_id);
    const children = all.filter(c => c.parent_id);

    return parents.map(parent => ({
      ...parent,
      children: children.filter(c => c.parent_id === parent.id)
    }));
  },

  /**
   * Get classification by ID
   */
  async getById(id) {
    const result = await pool.query(
      'SELECT * FROM expense_classifications WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  /**
   * Get classification by name (with optional parent)
   */
  async getByName(name, parentId = null) {
    const result = await pool.query(
      `SELECT * FROM expense_classifications
       WHERE LOWER(name) = LOWER($1) AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))`,
      [name, parentId]
    );
    return result.rows[0];
  },

  /**
   * Find classification by full path (e.g., "Software & Services > Subscriptions")
   */
  async getByPath(path) {
    const parts = path.split('>').map(p => p.trim());

    if (parts.length === 1) {
      return this.getByName(parts[0], null);
    }

    // Get parent first
    const parent = await this.getByName(parts[0], null);
    if (!parent) return null;

    // Get child
    return this.getByName(parts[1], parent.id);
  },

  /**
   * Create a new classification
   */
  async create(data) {
    const { name, parent_id, description, sort_order } = data;

    const result = await pool.query(
      `INSERT INTO expense_classifications (name, parent_id, description, is_default, sort_order)
       VALUES ($1, $2, $3, false, $4)
       RETURNING *`,
      [name, parent_id || null, description || null, sort_order || 0]
    );
    return result.rows[0];
  },

  /**
   * Update a classification
   */
  async update(id, data) {
    const { name, parent_id, description, sort_order } = data;

    const result = await pool.query(
      `UPDATE expense_classifications
       SET name = COALESCE($1, name),
           parent_id = $2,
           description = COALESCE($3, description),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5
       RETURNING *`,
      [name, parent_id, description, sort_order, id]
    );
    return result.rows[0];
  },

  /**
   * Delete a classification (only non-default)
   */
  async delete(id) {
    // Check if it's a default classification
    const classification = await this.getById(id);
    if (classification?.is_default) {
      throw new Error('Cannot delete default classification');
    }

    // Check if it has children
    const children = await pool.query(
      'SELECT COUNT(*) FROM expense_classifications WHERE parent_id = $1',
      [id]
    );
    if (parseInt(children.rows[0].count) > 0) {
      throw new Error('Cannot delete classification with subcategories');
    }

    const result = await pool.query(
      'DELETE FROM expense_classifications WHERE id = $1 AND is_default = false RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  /**
   * Get parent categories only
   */
  async getParents() {
    const result = await pool.query(`
      SELECT * FROM expense_classifications
      WHERE parent_id IS NULL
      ORDER BY sort_order, name
    `);
    return result.rows;
  },

  /**
   * Get children of a parent
   */
  async getChildren(parentId) {
    const result = await pool.query(`
      SELECT * FROM expense_classifications
      WHERE parent_id = $1
      ORDER BY sort_order, name
    `, [parentId]);
    return result.rows;
  },

  /**
   * Get full path string for a classification
   */
  async getFullPath(id) {
    const classification = await this.getById(id);
    if (!classification) return null;

    if (!classification.parent_id) {
      return classification.name;
    }

    const parent = await this.getById(classification.parent_id);
    return `${parent.name} > ${classification.name}`;
  },

  /**
   * Search classifications by name
   */
  async search(query) {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.parent_id,
        c.description,
        p.name as parent_name
      FROM expense_classifications c
      LEFT JOIN expense_classifications p ON c.parent_id = p.id
      WHERE c.name ILIKE $1 OR c.description ILIKE $1
      ORDER BY c.parent_id NULLS FIRST, c.name
    `, [`%${query}%`]);
    return result.rows;
  }
};

module.exports = ClassificationModel;
