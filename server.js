const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import configurations and middleware
const connectDB = require('./config/database');
const { socketAuth } = require('./middleware/auth');
const setupSocketHandlers = require('./socket/socketHandlers');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const scheduledMessageRoutes = require('./routes/scheduledMessages');
const messageTemplateRoutes = require('./routes/messageTemplates');
const autoResponseRoutes = require('./routes/autoResponses');
const messageReminderRoutes = require('./routes/messageReminders');
const savedMessageRoutes = require('./routes/savedMessages');
const archiveRoutes = require('./routes/archives');
const profileRoutes = require('./routes/profile');
const verificationRoutes = require('./routes/verification');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "https://chat-frontend-lovat-phi.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 30000, // 30 seconds
  allowEIO3: true
});

// Connect to MongoDB
connectDB();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const messagesDir = path.join(uploadsDir, 'messages');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
const backgroundsDir = path.join(uploadsDir, 'backgrounds');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(messagesDir)) {
  fs.mkdirSync(messagesDir, { recursive: true });
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}
if (!fs.existsSync(backgroundsDir)) {
  fs.mkdirSync(backgroundsDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://chat-frontend-lovat-phi.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Placeholder avatar route
app.get('/api/placeholder/:size/:size', (req, res) => {
  const size = parseInt(req.params.size) || 150;
  // Generate a simple SVG placeholder
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e2e8f0"/>
      <circle cx="${size/2}" cy="${size/3}" r="${size/8}" fill="#94a3b8"/>
      <path d="M${size/4} ${size*2/3} Q${size/2} ${size/2} ${size*3/4} ${size*2/3} 
               Q${size*3/4} ${size*5/6} ${size/2} ${size*5/6} 
               Q${size/4} ${size*5/6} ${size/4} ${size*2/3} Z" fill="#94a3b8"/>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.send(svg);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/scheduled-messages', scheduledMessageRoutes);
app.use('/api/message-templates', messageTemplateRoutes);
app.use('/api/auto-responses', autoResponseRoutes);
app.use('/api/message-reminders', messageReminderRoutes);
app.use('/api/saved-messages', savedMessageRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/verification', verificationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({ error: errors.join(', ') });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({ error: `${field} already exists` });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
});

// Socket.io authentication middleware
io.use(socketAuth);

// Setup socket handlers
const connectedUsers = setupSocketHandlers(io);

// Make io available to routes via app.locals
app.locals.io = io;
app.locals.connectedUsers = connectedUsers;

// Make io globally available for scheduled messages and auto-responses
global.io = io;

// Start message scheduler
const messageScheduler = require('./utils/messageScheduler');
messageScheduler.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  messageScheduler.stop();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  messageScheduler.stop();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
🚀 Chat Backend Server Started Successfully!
📍 Server running on port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📡 Socket.io enabled for real-time communication
🗄️  MongoDB connected
⏰ Started at: ${new Date().toISOString()}

API Endpoints:
🔐 Authentication: http://localhost:${PORT}/api/auth
👥 Users: http://localhost:${PORT}/api/users
💬 Messages: http://localhost:${PORT}/api/messages

📋 Message Templates: http://localhost:${PORT}/api/message-templates
⏰ Scheduled Messages: http://localhost:${PORT}/api/scheduled-messages
🤖 Auto Responses: http://localhost:${PORT}/api/auto-responses
⏰ Message Reminders: http://localhost:${PORT}/api/message-reminders
🔔 Notifications: http://localhost:${PORT}/api/notifications
❤️  Health Check: http://localhost:${PORT}/health
  `);
});

module.exports = { app, server, io };
