const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Email transporter configuration (you'll need to configure this with your email service)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// @desc    Request email verification
// @route   POST /api/verification/email
// @access  Private
const requestEmailVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.verification.isVerified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    // Store token temporarily (in production, you might want to use Redis or a separate token model)
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@chatapp.com',
      to: user.email,
      subject: 'Verify Your Email - Convo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Hello ${user.username},</p>
          <p>Please click the link below to verify your email address:</p>
          <a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ error: 'Server error sending verification email' });
  }
};

// @desc    Verify email with token
// @route   POST /api/verification/email/verify
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Mark user as verified
    user.verification.isVerified = true;
    user.verification.verifiedAt = new Date();
    user.verification.verificationType = 'email';
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    // Award verification badge
    await user.addBadge({
      type: 'verified',
      name: 'Email Verified',
      description: 'Verified email address',
      icon: '✓',
      color: '#10b981'
    });

    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Server error verifying email' });
  }
};

// @desc    Manual verification (Admin only)
// @route   POST /api/verification/manual/:userId
// @access  Private (Admin)
const manualVerification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { verificationType = 'manual' } = req.body;

    // TODO: Add admin check middleware
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.verification.isVerified) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    // Mark user as verified
    user.verification.isVerified = true;
    user.verification.verifiedAt = new Date();
    user.verification.verificationType = verificationType;

    // Award verification badge
    await user.addBadge({
      type: 'verified',
      name: 'Manually Verified',
      description: 'Manually verified by administrator',
      icon: '✓',
      color: '#10b981'
    });

    await user.save();

    res.json({
      success: true,
      message: 'User verified successfully'
    });
  } catch (error) {
    console.error('Error with manual verification:', error);
    res.status(500).json({ error: 'Server error with verification' });
  }
};

// @desc    Remove verification (Admin only)
// @route   DELETE /api/verification/:userId
// @access  Private (Admin)
const removeVerification = async (req, res) => {
  try {
    const { userId } = req.params;

    // TODO: Add admin check middleware
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove verification
    user.verification.isVerified = false;
    user.verification.verifiedAt = undefined;
    user.verification.verificationType = 'email';

    // Remove verification badges
    user.badges = user.badges.filter(badge => badge.type !== 'verified');

    await user.save();

    res.json({
      success: true,
      message: 'Verification removed successfully'
    });
  } catch (error) {
    console.error('Error removing verification:', error);
    res.status(500).json({ error: 'Server error removing verification' });
  }
};

// @desc    Get verification status
// @route   GET /api/verification/status
// @access  Private
const getVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('verification email');

    res.json({
      verification: user.verification,
      email: user.email
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({ error: 'Server error fetching verification status' });
  }
};

module.exports = {
  requestEmailVerification,
  verifyEmail,
  manualVerification,
  removeVerification,
  getVerificationStatus
};
