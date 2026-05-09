// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/db');
const { sendMail, emailRegistrationPending } = require('../config/email');

// ── Helper: sign JWT ─────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/login ─────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const [rows] = await db.query(
      'SELECT * FROM users WHERE (email = ? OR phone = ?) AND status = "active" LIMIT 1',
      [email, email]
    );
    if (!rows.length)
      return res.status(401).json({ message: 'Invalid credentials.' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ message: 'Invalid credentials.' });

    // Log activity
    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [user.id, `${user.name} logged in`]
    );

    const token = signToken(user);
    res.json({
      token,
      user: {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        phone:    user.phone,
        role:     user.role,
        verified: !!user.verified,
        purok:    user.purok,
        gender:   user.gender,
        birth_date: user.birth_date,
        age:      user.age,
        is_senior: !!user.is_senior,
        is_pwd:    !!user.is_pwd,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── POST /api/auth/register ──────────────────────────────────
async function register(req, res) {
  try {
    const { name, email, phone, password, purok, birth_date, age, gender } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required.' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    // Check duplicate email
    const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length)
      return res.status(409).json({ message: 'Email already registered.' });

    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users
         (name, email, phone, password_hash, role, status, verified,
          purok, birth_date, age, gender)
       VALUES (?, ?, ?, ?, 'user', 'active', 0, ?, ?, ?, ?)`,
      [name, email, phone || null, hash, purok || null, birth_date || null, age || null, gender || null]
    );

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [result.insertId, `New resident "${name}" registered — awaiting verification`]
    );

    // Send pending email
    const { subject, html, text } = emailRegistrationPending(name, email, purok);
    await sendMail({ to: email, subject, html, text });

    res.status(201).json({
      message: 'Account created! Awaiting barangay verification.',
      id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── POST /api/auth/logout ────────────────────────────────────
async function logout(req, res) {
  try {
    const token = req.token;
    const hash  = crypto.createHash('sha256').update(token).digest('hex');
    // Store token hash until its natural expiry
    await db.query(
      'INSERT IGNORE INTO token_blacklist (token_hash, expires_at) VALUES (?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
      [hash]
    );
    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `${req.user.name} logged out`]
    );
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────
async function me(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, phone, role, verified, purok, gender, birth_date, age, is_senior, is_pwd, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });
    const u = rows[0];
    u.verified  = !!u.verified;
    u.is_senior = !!u.is_senior;
    u.is_pwd    = !!u.is_pwd;
    res.json(u);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { login, register, logout, me };
