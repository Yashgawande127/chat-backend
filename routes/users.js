const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  getConversationMessages,
  getRecentConversations,
  updateUserStatus,
  getUserSettings,
  updateUserSettings,
  resetUserSettings,
  sendFriendRequest,
  respondToFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  exportUserData
} = require('../controllers/userController');

const router = express.Router();

// User routes
router.get('/', auth, getAllUsers);
router.get('/export-data', auth, exportUserData);
router.get('/conversations/recent', auth, getRecentConversations);
router.get('/friends', auth, getFriends);
router.get('/friend-requests', auth, getFriendRequests);
router.get('/settings', auth, getUserSettings);
router.patch('/settings', auth, updateUserSettings);
router.post('/settings/reset', auth, resetUserSettings);
router.get('/:id', auth, getUserById);
router.get('/:id/messages', auth, getConversationMessages);
router.post('/:id/friend-request', auth, sendFriendRequest);
router.patch('/friend-request/:requestId', auth, respondToFriendRequest);
router.delete('/friends/:friendId', auth, removeFriend);
router.patch('/status', auth, updateUserStatus);

module.exports = router;
