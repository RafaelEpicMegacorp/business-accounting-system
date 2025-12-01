const PositionModel = require('../models/positionModel');

const PositionController = {
  // GET /api/positions
  async getAll(req, res) {
    try {
      const positions = await PositionModel.getAll();
      res.json({ success: true, data: positions });
    } catch (error) {
      console.error('Error fetching positions:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch positions' });
    }
  },

  // GET /api/positions/counts
  async getCounts(req, res) {
    try {
      const counts = await PositionModel.getEmployeeCounts();
      res.json({ success: true, data: counts });
    } catch (error) {
      console.error('Error fetching position counts:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch position counts' });
    }
  },

  // GET /api/positions/:id
  async getById(req, res) {
    try {
      const position = await PositionModel.getById(req.params.id);
      if (!position) {
        return res.status(404).json({ success: false, error: 'Position not found' });
      }
      res.json({ success: true, data: position });
    } catch (error) {
      console.error('Error fetching position:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch position' });
    }
  },

  // POST /api/positions
  async create(req, res) {
    try {
      const { name, description, display_order } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Position name is required' });
      }
      const position = await PositionModel.create({ name, description, display_order });
      res.status(201).json({ success: true, data: position });
    } catch (error) {
      console.error('Error creating position:', error);
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'Position name already exists' });
      }
      res.status(500).json({ success: false, error: 'Failed to create position' });
    }
  },

  // PUT /api/positions/:id
  async update(req, res) {
    try {
      const position = await PositionModel.update(req.params.id, req.body);
      if (!position) {
        return res.status(404).json({ success: false, error: 'Position not found' });
      }
      res.json({ success: true, data: position });
    } catch (error) {
      console.error('Error updating position:', error);
      res.status(500).json({ success: false, error: 'Failed to update position' });
    }
  },

  // DELETE /api/positions/:id
  async delete(req, res) {
    try {
      const position = await PositionModel.delete(req.params.id);
      if (!position) {
        return res.status(404).json({ success: false, error: 'Position not found' });
      }
      res.json({ success: true, data: position, message: 'Position deactivated' });
    } catch (error) {
      console.error('Error deleting position:', error);
      res.status(500).json({ success: false, error: 'Failed to delete position' });
    }
  }
};

module.exports = PositionController;
