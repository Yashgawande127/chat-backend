const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');
const {
  getUserProfile,
  updateProfile,
  addToFavorites,
  removeFromFavorites,
  blockUser,
  unblockUser,
  getUserBadges,
  awardBadge,
  getFavorites,
  getBlockedUsers,
  uploadProfileBackground,
  uploadAvatar,
  deleteAvatar,
  getUserStats
} = require('../controllers/profileController');

const router = express.Router();

// Configure multer for background image uploads
const backgroundStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/backgrounds/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'bg-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const backgroundUpload = multer({
  storage: backgroundStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Profile routes
router.get('/', auth, getUserProfile);
router.get('/stats/:id?', auth, getUserStats);
router.get('/:id', auth, getUserProfile);
router.patch('/', auth, updateProfile);

// Background image upload
router.post('/background', auth, backgroundUpload.single('background'), uploadProfileBackground);

// Avatar upload
router.post('/avatar', auth, avatarUpload.single('avatar'), uploadAvatar);

// Delete avatar
router.delete('/avatar', auth, deleteAvatar);

// Favorites management
router.get('/favorites', auth, getFavorites);
router.post('/favorites/:id', auth, addToFavorites);
router.delete('/favorites/:id', auth, removeFromFavorites);

// Blocked users management
router.get('/blocked', auth, getBlockedUsers);
router.post('/block/:id', auth, blockUser);
router.delete('/block/:id', auth, unblockUser);

// Badges
router.get('/badges', auth, getUserBadges);
router.post('/badges/:userId', auth, awardBadge); // Admin only

module.exports = router;
