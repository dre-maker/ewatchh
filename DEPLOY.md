# eWatch — Deploy Guide
## Barangay Bancao-Bancao Digital Census MIS

---

## Project Structure
```
ewatch/
├── server.js          ← Start this (node server.js)
├── package.json
├── seed.js            ← Run once to create default accounts
├── database.sql       ← Run once in MySQL
├── .env.example       ← Copy to .env and fill in values
│
├── public/            ← Frontend (served automatically)
│   ├── login.html
│   ├── user.html
│   ├── admin.html
│   ├── superadmin.html
│   ├── css/
│   └── js/
│
├── config/
│   ├── db.js          ← MySQL connection
│   └── email.js       ← Nodemailer email templates
├── middleware/auth.js ← JWT authentication
├── controllers/       ← Business logic
├── routes/index.js    ← All API endpoints
└── uploads/           ← Report file uploads (auto-created)
```

---

## Step 1 — MySQL Setup

```sql
-- Run in MySQL shell or phpMyAdmin
mysql -u root -p < database.sql
```

Tables created: `users`, `reports`, `report_files`, `activities`, `token_blacklist`

---

## Step 2 — Configure .env

```bash
cp .env.example .env
nano .env
```

Fill in:
```
DB_PASSWORD=your_mysql_password
JWT_SECRET=any_random_string_at_least_32_characters
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_gmail_app_password
```

---

## Step 3 — Install & Seed

```bash
npm install
node seed.js
```

Default accounts created:
| Role        | Email                    | Password |
|-------------|--------------------------|----------|
| Super Admin | superadmin@ewatch.ph     | super123 |
| Admin       | admin@ewatch.ph          | admin123 |
| Resident    | juan@gmail.com           | user123  |

---

## Step 4 — Start Server

```bash
node server.js
```

Open browser: http://localhost:3000

---

## Gmail App Password Setup

1. Go to myaccount.google.com
2. Security → 2-Step Verification → enable it
3. Security → App passwords
4. Select "Mail" → generate
5. Copy the 16-character password to SMTP_PASS in .env

---

## API Endpoints

```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/reports
POST   /api/reports          (with file upload)
PATCH  /api/reports/:id/status
GET    /api/reports/stats

GET    /api/users
GET    /api/users/census-summary
GET    /api/users/pending-verif
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
POST   /api/users/:id/verify  ← sends email automatically
POST   /api/users/:id/reject  ← sends email automatically

GET    /api/overview
GET    /api/activities
GET    /api/admins            (super admin only)
POST   /api/admins
```
