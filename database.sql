-- ============================================================
--  eWatch — MySQL Database Schema
--  Barangay Bancao-Bancao Digital Census MIS
--  Run this file once to set up your database
-- ============================================================

CREATE DATABASE IF NOT EXISTS ewatch_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ewatch_db;

-- ── USERS (accounts for all roles) ──────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  phone         VARCHAR(20)   DEFAULT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('super-admin','admin','user') NOT NULL DEFAULT 'user',
  status        ENUM('active','inactive')          NOT NULL DEFAULT 'active',
  verified      TINYINT(1)    NOT NULL DEFAULT 0,
  purok         VARCHAR(100)  DEFAULT NULL,
  birth_date    DATE          DEFAULT NULL,
  age           TINYINT UNSIGNED DEFAULT NULL,
  gender        ENUM('Male','Female','Other')      DEFAULT NULL,
  is_senior     TINYINT(1)    NOT NULL DEFAULT 0,
  is_pwd        TINYINT(1)    NOT NULL DEFAULT 0,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email  (email),
  INDEX idx_role   (role),
  INDEX idx_purok  (purok)
) ENGINE=InnoDB;

-- ── REPORTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  category    VARCHAR(80)   NOT NULL,
  type        VARCHAR(100)  NOT NULL,
  location    VARCHAR(150)  DEFAULT NULL,
  description TEXT          NOT NULL,
  status      ENUM('Pending','In Progress','Done') NOT NULL DEFAULT 'Pending',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id   (user_id),
  INDEX idx_status    (status),
  INDEX idx_category  (category),
  INDEX idx_created   (created_at)
) ENGINE=InnoDB;

-- ── REPORT ATTACHMENTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_files (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  report_id   INT           NOT NULL,
  filename    VARCHAR(255)  NOT NULL,
  original    VARCHAR(255)  NOT NULL,
  mimetype    VARCHAR(100)  NOT NULL,
  size        INT           NOT NULL,
  uploaded_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  INDEX idx_report_id (report_id)
) ENGINE=InnoDB;

-- ── ACTIVITIES LOG ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           DEFAULT NULL,
  action      VARCHAR(255)  NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ── SESSIONS (JWT blacklist for logout) ─────────────────────
CREATE TABLE IF NOT EXISTS token_blacklist (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(64)  NOT NULL UNIQUE,
  expires_at TIMESTAMP    NOT NULL,
  INDEX idx_token (token_hash),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA — Default accounts
--  Passwords are bcrypt hashes:
--    super123 → $2b$10$...
--    admin123 → $2b$10$...
--    user123  → $2b$10$...
--  (Real hashes inserted by seed.js — see below)
-- ============================================================
