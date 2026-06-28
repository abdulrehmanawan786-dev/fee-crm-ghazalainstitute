-- Ghazala Institute Fee CRM — Database Schema
-- Run this once on your MySQL server to create the database and tables.

CREATE DATABASE IF NOT EXISTS ghazala_fees CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ghazala_fees;

-- Admin users who can log in. Create the first admin via the seed script
-- (server/utils/seedAdmin.js), not by hand, so the password is hashed correctly.
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','agent') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slip_no VARCHAR(50),
  phone VARCHAR(50),
  course VARCHAR(100) NOT NULL,
  mode ENUM('Onsite','Online') NOT NULL DEFAULT 'Onsite',
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  course_fee INT NOT NULL DEFAULT 0,
  registration_fee INT NOT NULL DEFAULT 0,
  reg_date DATE NOT NULL,
  discount INT NOT NULL DEFAULT 0,
  payment_mode ENUM('installment','lumpsum') NOT NULL DEFAULT 'installment',
  remarks ENUM('Drop','Refund') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reg_date (reg_date),
  INDEX idx_course (course)
);

-- Each registration fee / 1st installment / 2nd installment / lumpsum payment is its
-- own row with its own due date, so monthly reports are a plain SQL query
-- (WHERE MONTH(due_date) = ... AND YEAR(due_date) = ...) — never an in-memory hack.
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(36) NOT NULL,
  type ENUM('registration','installment1','installment2','lumpsum') NOT NULL,
  amount INT NOT NULL,
  due_date DATE,
  paid_date DATE DEFAULT NULL,
  method VARCHAR(50) DEFAULT NULL,
  was_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_number INT DEFAULT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_due_date (due_date),
  INDEX idx_paid_date (paid_date),
  INDEX idx_student (student_id)
);

CREATE TABLE IF NOT EXISTS student_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(36) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Phase 1: records every login attempt (success and failure) for the Login History view.
CREATE TABLE IF NOT EXISTS login_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_created_at (created_at)
);
-- Phase 4: WhatsApp fee reminders — every reminder sent (manual or automatic) is logged here.
CREATE TABLE IF NOT EXISTS reminder_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(36) NOT NULL,
  sent_by VARCHAR(50) NOT NULL,
  sent_by_role VARCHAR(20) NOT NULL,
  message_type VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_created_at (created_at)
);

-- Phase 4: forgot-password reset links sent via WhatsApp. Tokens expire after 30 minutes.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
  INDEX idx_token (token)
);
