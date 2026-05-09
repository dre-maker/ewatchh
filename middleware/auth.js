// middleware/auth.js — JWT authentication + role guards
const jwt = require('jsonwebtoken');
const db  = require('../config/db');

// ── Verify JWT token ─────────────────────────────────────────
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check token blacklist (logout)
    const hash = require('crypto').createHash('sha256').update(token).digest('hex');
    const [blacklisted] = await db.query(
      'SELECT id FROM token_blacklist WHERE token_hash = ? AND expires_at > NOW()',
      [hash]
    );
    if (blacklisted.length > 0) {
      return res.status(401).json({ message: 'Token has been revoked.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user  = decoded;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// ── Role guards ──────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    next();
  };
}

const requireSuperAdmin = requireRole('super-admin');
const requireAdmin      = requireRole('super-admin', 'admin');
const requireUser       = requireRole('super-admin', 'admin', 'user');

module.exports = { authenticate, requireRole, requireSuperAdmin, requireAdmin, requireUser };
