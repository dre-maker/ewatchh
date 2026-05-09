// controllers/usersController.js
const bcrypt = require('bcryptjs');
const db     = require('../config/db');
const { sendMail, emailAccountVerified, emailAccountRejected } = require('../config/email');

// ── GET /api/users — all residents (admin+) ──────────────────
async function getUsers(req, res) {
  try {
    const { role, purok, gender, verified, search, tag, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = ['role = "user"'];
    let params = [];

    if (purok)    { where.push('purok = ?');      params.push(purok); }
    if (gender)   { where.push('gender = ?');     params.push(gender); }
    if (verified !== undefined) {
      where.push('verified = ?');
      params.push(verified === 'true' ? 1 : 0);
    }
    if (tag === 'senior') { where.push('(is_senior = 1 OR age >= 60)'); }
    if (tag === 'pwd')    { where.push('is_pwd = 1'); }
    if (search) {
      where.push('(name LIKE ? OR email LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s);
    }

    const whereSQL = 'WHERE ' + where.join(' AND ');

    const [rows] = await db.query(
      `SELECT id, name, email, phone, purok, gender, birth_date, age,
              is_senior, is_pwd, verified, status, created_at
       FROM users ${whereSQL}
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    rows.forEach(r => {
      r.verified  = !!r.verified;
      r.is_senior = !!r.is_senior;
      r.is_pwd    = !!r.is_pwd;
    });

    const [countRow] = await db.query(
      `SELECT COUNT(*) AS total FROM users ${whereSQL}`,
      params
    );

    res.json({ data: rows, total: countRow[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── GET /api/users/census-summary ───────────────────────────
async function getCensusSummary(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        COUNT(*)                              AS total,
        SUM(gender = 'Male')                  AS male,
        SUM(gender = 'Female')                AS female,
        SUM(is_senior = 1 OR age >= 60)       AS senior,
        SUM(is_pwd = 1)                       AS pwd,
        SUM(verified = 1)                     AS verified,
        SUM(verified = 0)                     AS pending_verif
      FROM users WHERE role = 'user'
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── GET /api/users/pending-verif ─────────────────────────────
async function getPendingVerif(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, phone, purok, birth_date, created_at
       FROM users WHERE role = 'user' AND verified = 0
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── POST /api/users/:id/verify ───────────────────────────────
async function verifyUser(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND role = "user"',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    const u = rows[0];
    if (u.verified) return res.status(400).json({ message: 'User already verified.' });

    await db.query('UPDATE users SET verified = 1 WHERE id = ?', [u.id]);

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Account "${u.name}" verified by ${req.user.name}`]
    );

    // Send verification email
    const { subject, html, text } = emailAccountVerified(u.name, u.email, u.purok);
    const emailResult = await sendMail({ to: u.email, subject, html, text });

    res.json({
      message:      'User verified successfully.',
      emailSent:    emailResult.success,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── POST /api/users/:id/reject ───────────────────────────────
async function rejectUser(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND role = "user"',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    const u = rows[0];

    // Send rejection email before deleting
    const { subject, html, text } = emailAccountRejected(u.name);
    await sendMail({ to: u.email, subject, html, text });

    await db.query('DELETE FROM users WHERE id = ?', [u.id]);

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Account "${u.name}" rejected and removed by ${req.user.name}`]
    );

    res.json({ message: 'User rejected and removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── POST /api/users — Add resident (admin+) ──────────────────
async function createUser(req, res) {
  try {
    const { name, email, phone, purok, birth_date, age, gender, is_senior, is_pwd, password } = req.body;
    if (!name || !purok)
      return res.status(400).json({ message: 'Name and purok are required.' });

    const pwd  = password || 'ewatch2024';
    const hash = await bcrypt.hash(pwd, 10);

    const [result] = await db.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status, verified,
         purok, birth_date, age, gender, is_senior, is_pwd)
       VALUES (?, ?, ?, ?, 'user', 'active', 1, ?, ?, ?, ?, ?, ?)`,
      [name, email || null, phone || null, hash, purok, birth_date || null,
       age || null, gender || null, is_senior ? 1 : 0, is_pwd ? 1 : 0]
    );

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Resident "${name}" added to census by ${req.user.name}`]
    );

    res.status(201).json({ message: 'Resident added.', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── PUT /api/users/:id — Edit resident ──────────────────────
async function updateUser(req, res) {
  try {
    const { name, purok, birth_date, age, gender, is_senior, is_pwd, phone } = req.body;

    await db.query(
      `UPDATE users SET
         name = ?, purok = ?, birth_date = ?, age = ?, gender = ?,
         is_senior = ?, is_pwd = ?, phone = ?
       WHERE id = ?`,
      [name, purok, birth_date || null, age || null, gender || null,
       is_senior ? 1 : 0, is_pwd ? 1 : 0, phone || null, req.params.id]
    );

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Resident record #${req.params.id} updated by ${req.user.name}`]
    );

    res.json({ message: 'Resident updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

// ── DELETE /api/users/:id ────────────────────────────────────
async function deleteUser(req, res) {
  try {
    const [rows] = await db.query('SELECT name FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found.' });

    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);

    await db.query(
      'INSERT INTO activities (user_id, action) VALUES (?, ?)',
      [req.user.id, `Resident "${rows[0].name}" removed by ${req.user.name}`]
    );

    res.json({ message: 'Resident removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = {
  getUsers, getCensusSummary, getPendingVerif,
  verifyUser, rejectUser,
  createUser, updateUser, deleteUser,
};
