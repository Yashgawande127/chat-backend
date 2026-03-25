const express = require('express');
const { auth } = require('../middleware/auth');
const {
  requestEmailVerification,
  verifyEmail,
  manualVerification,
  removeVerification,
  getVerificationStatus
} = require('../controllers/verificationController');

const router = express.Router();

// Verification routes
router.get('/status', auth, getVerificationStatus);
router.post('/email', auth, requestEmailVerification);
router.post('/email/verify', verifyEmail); // Public route
router.post('/manual/:userId', auth, manualVerification); // Admin only
router.delete('/:userId', auth, removeVerification); // Admin only

module.exports = router;
