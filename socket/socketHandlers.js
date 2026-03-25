const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { calculateUserStats } = require('../controllers/profileController');

const setupSocketHandlers = (io) => {
  const connectedUsers = new Map();

  io.on('connection', async (socket) => {
    try {
      console.log(`User connected: ${socket.id}`);
      
      // Store user info
      if (socket.user) {
        connectedUsers.set(socket.user._id.toString(), {
          socketId: socket.id,
          user: socket.user,
          lastSeen: new Date()
        });

        // Join user to their personal room
        socket.join(`user_${socket.user._id}`);

        // Update user status to online
        await User.findByIdAndUpdate(socket.user._id, {
          status: 'online',
          lastSeen: new Date()
        });

        // Broadcast user came online
        socket.broadcast.emit('userStatusChange', {
          userId: socket.user._id,
          status: 'online'
        });

        console.log(`User ${socket.user.username} (${socket.user._id}) connected`);
      }

      // Handle getting online users
      socket.on('getOnlineUsers', () => {
        const onlineUserIds = Array.from(connectedUsers.keys());
        socket.emit('onlineUsersList', onlineUserIds);
      });



      // Handle typing indicators
      socket.on('typing', (data) => {
        if (data.receiverId) {
          socket.to(`user_${data.receiverId}`).emit('userTyping', {
            userId: socket.user._id,
            username: socket.user.username
          });
        }
      });

      socket.on('stopTyping', (data) => {
        if (data.receiverId) {
          socket.to(`user_${data.receiverId}`).emit('userStoppedTyping', {
            userId: socket.user._id
          });
        }
      });

      // Handle user status updates
      socket.on('updateStatus', async (status) => {
        if (['online', 'away', 'busy'].includes(status)) {
          await User.findByIdAndUpdate(socket.user._id, { status });
          
          // Broadcast status change
          socket.broadcast.emit('userStatusChange', {
            userId: socket.user._id,
            status
          });
        }
      });

      // Handle message reactions
      socket.on('messageReaction', (data) => {
        const { messageId, emoji, receiverId, reactions } = data;
        
        if (receiverId) {
          // Send to both the sender and receiver of the direct message
          socket.emit('messageReactionUpdate', {
            messageId,
            emoji,
            reactions,
            userId: socket.user._id
          });
          socket.to(`user_${receiverId}`).emit('messageReactionUpdate', {
            messageId,
            emoji,
            reactions,
            userId: socket.user._id
          });
        }
      });

      // Handle message forwarding
      socket.on('messageForwarded', (data) => {
        const { forwardedMessages, originalMessageId } = data;
        
        // Notify recipients about forwarded messages
        forwardedMessages.forEach(message => {
          if (message.receiver) {
            socket.to(`user_${message.receiver}`).emit('newMessage', message);
          }
        });
      });

      // Handle message pinning
      socket.on('messagePinned', (data) => {
        const { messageId, isPinned, receiverId } = data;
        
        if (receiverId) {
          socket.to(`user_${receiverId}`).emit('messagePinUpdate', {
            messageId,
            isPinned,
            pinnedBy: socket.user._id
          });
        }
      });

      // Handle message replies
      socket.on('messageReply', (data) => {
        const { replyMessage, receiverId } = data;
        
        if (receiverId) {
          socket.to(`user_${receiverId}`).emit('newMessage', replyMessage);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.id}`);
        
        if (socket.user) {
          connectedUsers.delete(socket.user._id.toString());
          
          // Update user status to offline
          await User.findByIdAndUpdate(socket.user._id, {
            status: 'offline',
            lastSeen: new Date()
          });

          // Broadcast user went offline
          socket.broadcast.emit('userStatusChange', {
            userId: socket.user._id,
            status: 'offline'
          });

          console.log(`User ${socket.user.username} (${socket.user._id}) disconnected`);
        }
      });

    } catch (error) {
      console.error('Socket connection error:', error);
      socket.emit('error', 'Connection failed');
    }
  });

  // Helper function to emit stats updates
  const emitStatsUpdate = async (userId) => {
    try {
      const stats = await calculateUserStats(userId);
      io.to(`user_${userId}`).emit('statsUpdate', { stats });
    } catch (error) {
      console.error('Error emitting stats update:', error);
    }
  };

  // Expose helper function
  io.emitStatsUpdate = emitStatsUpdate;

  return connectedUsers;
};

module.exports = setupSocketHandlers;
