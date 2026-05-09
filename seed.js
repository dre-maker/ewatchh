// seed.js — Seed default accounts into MySQL
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./config/db');

async function seed() {
  console.log('🌱 Seeding default accounts...');

  const accounts = [
    {
      name:     'Super Admin',
      email:    'superadmin@ewatch.ph',
      phone:    '09100000001',
      password: 'super123',
      role:     'super-admin',
      verified: 1,
    },
    {
      name:     'Maria Agustin',
      email:    'admin@ewatch.ph',
      phone:    '09100000002',
      password: 'admin123',
      role:     'admin',
      verified: 1,
    },
    {
      name:       'Juan Dela Cruz',
      email:      'juan@gmail.com',
      phone:      '09123456789',
      password:   'user123',
      role:       'user',
      verified:   1,
      purok:      'Purok Malaya',
      birth_date: '1999-03-12',
      age:        25,
      gender:     'Male',
    },
  ];

  for (const acc of accounts) {
    const hash = await bcrypt.hash(acc.password, 10);
    try {
      await db.query(
        `INSERT INTO users
           (name, email, phone, password_hash, role, status, verified,
            purok, birth_date, age, gender)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           password_hash = VALUES(password_hash),
           role          = VALUES(role),
           verified      = VALUES(verified)`,
        [acc.name, acc.email, acc.phone, hash, acc.role, acc.verified,
         acc.purok || null, acc.birth_date || null, acc.age || null, acc.gender || null]
      );
      console.log(`  ✅ ${acc.role}: ${acc.email} / ${acc.password}`);
    } catch (err) {
      console.error(`  ❌ ${acc.email}:`, err.message);
    }
  }

  // Seed sample residents
  const residents = [
    { name: 'Maria Santos',     phone: '09187654321', purok: 'Purok Masikap',      birth_date: '1994-07-22', age: 30, gender: 'Female' },
    { name: 'Pedro Reyes',      phone: '09111111111', purok: 'Purok Maligaya',     birth_date: '1989-01-05', age: 35, gender: 'Male',   is_pwd: 1 },
    { name: 'Ana Lim',          phone: '09222222222', purok: 'Purok Malaya',       birth_date: '1996-11-18', age: 28, gender: 'Female' },
    { name: 'Jose Garcia',      phone: '09333333333', purok: 'Purok Masikap',      birth_date: '1982-09-30', age: 42, gender: 'Male'   },
    { name: 'Luz Mendoza',      phone: '09444444444', purok: 'Purok Bagong Buhay', birth_date: '1955-04-14', age: 69, gender: 'Female', is_senior: 1 },
    { name: 'Carlo Torres',     phone: '09555555555', purok: 'Purok Pagkakaisa',   birth_date: '1991-06-27', age: 33, gender: 'Male'   },
    { name: 'Elena Villanueva', phone: '09666666666', purok: 'Purok Masikap',      birth_date: '1957-08-10', age: 67, gender: 'Female', is_senior: 1, is_pwd: 1 },
  ];

  for (const r of residents) {
    const email = r.name.toLowerCase().replace(/\s+/g, '.') + '@gmail.com';
    const hash  = await bcrypt.hash('user123', 10);
    try {
      await db.query(
        `INSERT IGNORE INTO users
           (name, email, phone, password_hash, role, status, verified,
            purok, birth_date, age, gender, is_senior, is_pwd)
         VALUES (?, ?, ?, ?, 'user', 'active', 1, ?, ?, ?, ?, ?, ?)`,
        [r.name, email, r.phone, hash,
         r.purok, r.birth_date, r.age, r.gender,
         r.is_senior || 0, r.is_pwd || 0]
      );
      console.log(`  ✅ resident: ${r.name} (${r.purok})`);
    } catch (err) {
      console.error(`  ❌ ${r.name}:`, err.message);
    }
  }

  console.log('\n✅ Seeding complete!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
