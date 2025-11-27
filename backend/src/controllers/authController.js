const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Hardcoded user credentials
// Password: asdflkj@3!
// Hash generated with: bcrypt.hashSync('asdflkj@3!', 10)
const HARDCODED_USER = {
  username: 'rafael',
  passwordHash: '$2b$10$6eYFtMerCtzPOb4FqLt8eefriabMu/CGC28tD2z0mGOow6ZDwgKoe', // asdflkj@3!
  id: 1,
  name: 'Rafael',
  role: 'admin'
};

class AuthController {
  // Login
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      // Check username
      if (username !== HARDCODED_USER.username) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, HARDCODED_USER.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: HARDCODED_USER.id,
          username: HARDCODED_USER.username,
          name: HARDCODED_USER.name,
          role: HARDCODED_USER.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: HARDCODED_USER.id,
          username: HARDCODED_USER.username,
          name: HARDCODED_USER.name,
          role: HARDCODED_USER.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login' });
    }
  }

  // Get current user
  async me(req, res) {
    try {
      // User info is already in req.user from auth middleware
      res.json({
        user: {
          id: req.user.id,
          username: req.user.username,
          name: req.user.name,
          role: req.user.role
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }

  // Logout (client-side will handle token removal)
  async logout(req, res) {
    res.json({ success: true, message: 'Logged out successfully' });
  }
}

module.exports = new AuthController();
