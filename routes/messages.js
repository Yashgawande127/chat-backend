const express = require('express');
const { auth } = require('../middleware/auth');
const { upload } = require('../config/multer');
const path = require('path');
const fs = require('fs');
const {
  sendMessage,
  getConversation,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  deleteConversation,
  getUnreadCount,
  searchMessages,
  getConversations,
  addReaction,
  forwardMessage,
  togglePinMessage,
  getPinnedMessages,
  replyToMessage
} = require('../controllers/messageController');

const router = express.Router();

// Message routes
router.post('/', auth, sendMessage);
router.post('/upload', auth, ...upload.single('file'), sendMessage);
router.post('/reply', auth, replyToMessage);
router.post('/reply/upload', auth, ...upload.single('file'), replyToMessage);
router.get('/search', auth, searchMessages);
router.get('/conversations', auth, getConversations);

router.get('/conversation/:userId', auth, getConversation);
router.get('/pinned', auth, getPinnedMessages);
router.delete('/conversation/:userId', auth, deleteConversation);
router.get('/unread/count', auth, getUnreadCount);
router.patch('/read/:senderId', auth, markMessagesAsRead);
router.patch('/:messageId', auth, editMessage);
router.patch('/:messageId/pin', auth, togglePinMessage);
router.post('/:messageId/reaction', auth, addReaction);
router.post('/:messageId/forward', auth, forwardMessage);
router.delete('/:messageId', auth, deleteMessage);

// File download route
router.get('/download/:filename', auth, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'messages', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers for download
    const originalName = req.query.name || filename;
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Error downloading file' });
  }
});

module.exports = router;
