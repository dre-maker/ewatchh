// config/email.js — Nodemailer transporter + email templates
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection on startup (only in production)
if (process.env.NODE_ENV === 'production') {
  transporter.verify((err) => {
    if (err) console.error('❌ SMTP error:', err.message);
    else     console.log('✅ SMTP ready');
  });
}

// ── Send helper ─────────────────────────────────────────────
async function sendMail({ to, subject, html, text }) {
  try {
    const info = await transporter.sendMail({
      from:    process.env.MAIL_FROM,
      to, subject, html, text,
    });
    console.log('📧 Email sent to', to, '|', info.messageId);
    return { success: true };
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Email Templates ──────────────────────────────────────────
function emailBase(content) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f4ff;margin:0;padding:0}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,.1)}
  .header{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center}
  .header h1{color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.5px}
  .header p{color:rgba(255,255,255,.8);font-size:13px;margin:6px 0 0}
  .body{padding:28px 32px}
  .body p{color:#374151;font-size:14px;line-height:1.6;margin-bottom:12px}
  .highlight{background:#eef2ff;border-left:4px solid #4f46e5;border-radius:8px;padding:14px 18px;margin:18px 0}
  .highlight p{margin:4px 0;color:#1e1b4b;font-size:13.5px}
  .highlight strong{color:#4f46e5}
  .btn{display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:18px 0}
  .footer{background:#f8f7ff;border-top:1px solid #e5e3f0;padding:18px 32px;text-align:center}
  .footer p{color:#9ca3af;font-size:12px;margin:4px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏘 eWatch</h1>
    <p>Barangay Bancao-Bancao Digital Census MIS</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>This is an automated message from eWatch — Barangay Bancao-Bancao.</p>
    <p>If you did not register, please ignore this email or visit the Barangay Hall.</p>
  </div>
</div>
</body></html>`;
}

function emailRegistrationPending(name, email, purok) {
  const html = emailBase(`
    <p>Hi <strong>${name}</strong>,</p>
    <p>Thank you for registering with <strong>eWatch</strong> — the official community monitoring system of Barangay Bancao-Bancao.</p>
    <p>Your account has been created and is currently <strong>pending verification</strong> by barangay officials.</p>
    <div class="highlight">
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Purok:</strong> ${purok || 'Not specified'}</p>
      <p><strong>Registered:</strong> ${new Date().toLocaleString('en-PH')}</p>
    </div>
    <p>Once verified, you will receive a confirmation email and will be able to submit community reports.</p>
    <p>If you have questions, please visit the Barangay Bancao-Bancao Hall.</p>
    <p>Mabuhay!</p>
  `);
  return {
    subject: '📋 eWatch Registration Received — Barangay Bancao-Bancao',
    html,
    text: `Hi ${name}, your eWatch account is pending verification. We will email you once approved.`,
  };
}

function emailAccountVerified(name, email, purok) {
  const html = emailBase(`
    <p>Hi <strong>${name}</strong> 🎉</p>
    <p>Congratulations! Your eWatch account has been <strong>officially verified</strong> by Barangay Bancao-Bancao officials.</p>
    <p>You can now log in and access all features:</p>
    <ul style="color:#374151;font-size:14px;line-height:1.8;padding-left:20px">
      <li>Submit community reports (theft, infrastructure, noise, etc.)</li>
      <li>Track the status of your reports in real-time</li>
      <li>View barangay announcements and updates</li>
    </ul>
    <div class="highlight">
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Purok:</strong> ${purok || 'Not specified'}</p>
      <p><strong>Verified:</strong> ${new Date().toLocaleString('en-PH')}</p>
    </div>
    <p>Sign in using your registered email and password.</p>
    <p>Mabuhay!</p>
  `);
  return {
    subject: '🎉 Your eWatch Account is Now Verified! — Barangay Bancao-Bancao',
    html,
    text: `Hi ${name}, your eWatch account has been verified! You can now log in and submit reports.`,
  };
}

function emailAccountRejected(name) {
  const html = emailBase(`
    <p>Hi <strong>${name}</strong>,</p>
    <p>We regret to inform you that your eWatch account registration <strong>could not be approved</strong> at this time.</p>
    <p><strong>Reason:</strong> Barangay records could not verify your residency in Barangay Bancao-Bancao.</p>
    <p>If you believe this is an error, please visit the Barangay Hall in person with a valid proof of residency and request manual verification.</p>
    <p>Thank you for your understanding.</p>
  `);
  return {
    subject: 'eWatch Account Registration Update — Barangay Bancao-Bancao',
    html,
    text: `Hi ${name}, your eWatch account registration could not be approved. Please visit the Barangay Hall for assistance.`,
  };
}

module.exports = {
  sendMail,
  emailRegistrationPending,
  emailAccountVerified,
  emailAccountRejected,
};
