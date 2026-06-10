const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Luxe Fashion" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

const sendOTPEmail = async (email, otp) => {
  return sendEmail({
    to: email,
    subject: 'Email Verification - Luxe Fashion',
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Verify Your Email</h2>
      <p>Your OTP for email verification is:</p>
      <h1 style="color: #C9A227; font-size: 32px; letter-spacing: 8px;">${otp}</h1>
      <p>This OTP expires in 10 minutes.</p>
      <p>If you didn't request this, ignore this email.</p>
    </div>`,
  });
};

const sendWelcomeEmail = async (email, name) => {
  return sendEmail({
    to: email,
    subject: 'Welcome to Luxe Fashion',
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Welcome, ${name}!</h2>
      <p>Thank you for joining Luxe Fashion. Start exploring the latest trends in fashion.</p>
      <a href="${process.env.CLIENT_URL}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; margin-top: 16px;">Shop Now</a>
    </div>`,
  });
};

const sendPasswordResetEmail = async (email, resetUrl) => {
  return sendEmail({
    to: email,
    subject: 'Password Reset - Luxe Fashion',
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset Your Password</h2>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; margin-top: 16px;">Reset Password</a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    </div>`,
  });
};

const sendVendorApprovalEmail = async (email, storeName, status) => {
  const isApproved = status === 'approved';
  return sendEmail({
    to: email,
    subject: `Vendor ${isApproved ? 'Approved' : 'Rejected'} - Luxe Fashion`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Vendor Application ${isApproved ? 'Approved' : 'Rejected'}</h2>
      <p>Dear ${storeName},</p>
      <p>Your vendor application has been <strong>${status}</strong>.</p>
      ${isApproved ? `<a href="${process.env.VENDOR_URL}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; margin-top: 16px;">Go to Dashboard</a>` : ''}
    </div>`,
  });
};

module.exports = { sendEmail, sendOTPEmail, sendWelcomeEmail, sendPasswordResetEmail, sendVendorApprovalEmail };
