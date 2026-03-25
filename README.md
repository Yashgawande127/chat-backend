# Real-Time Chat Application Backend

A complete Node.js backend for a real-time chat application built with Express.js, MongoDB, Socket.io, and JWT authentication.

## Features

### 🔐 Authentication & Authorization
- User registration and login with JWT tokens
- Password hashing with bcrypt
- Protected routes with middleware
- Token-based authentication for Socket.io

### 💬 Real-Time Messaging
- Direct messages between users
- Group chat rooms
- Real-time message delivery with Socket.io
- Message read receipts
- Typing indicators
- Message editing and deletion (within time limit)

### 👥 User Management
- User profiles with avatars
- Online/offline status tracking
- User search functionality
- Last seen timestamps

### 🏠 Room Management
- Create and manage chat rooms
- Join/leave rooms
- Room member management with roles (admin, moderator, member)
- Private and public rooms
- Room message history

### 🚀 Additional Features
- Message pagination
- Unread message counts
- Conversation history
- User status updates
- Real-time user presence
- Error handling and validation
- CORS support
- Request logging

## Tech Stack

- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **Socket.io** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **dotenv** - Environment variables

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB installation
- npm or yarn

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the backend directory:
```env
MONGODB_URI=mongodb+srv://gawandeyash36:GASQIuYJw7gUd74G@chat.ixcdu8l.mongodb.net/?retryWrites=true&w=majority&appName=Chat
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### 3. Start the Server

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

#### Logout User
```http
POST /api/auth/logout
Authorization: Bearer <jwt_token>
```

### User Endpoints

#### Get All Users
```http
GET /api/users?search=john&page=1&limit=20
Authorization: Bearer <jwt_token>
```

#### Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <jwt_token>
```

#### Get Recent Conversations
```http
GET /api/users/conversations/recent
Authorization: Bearer <jwt_token>
```

#### Update User Status
```http
PATCH /api/users/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "online" // "online", "offline", "away"
}
```

### Message Endpoints

#### Send Message
```http
POST /api/messages
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "receiverId": "user_id",
  "content": "Hello there!",
  "messageType": "text"
}
```

#### Get Conversation
```http
GET /api/messages/conversation/:userId?page=1&limit=50
Authorization: Bearer <jwt_token>
```

#### Mark Messages as Read
```http
PATCH /api/messages/read/:senderId
Authorization: Bearer <jwt_token>
```

#### Edit Message
```http
PATCH /api/messages/:messageId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "Updated message content"
}
```

#### Delete Message
```http
DELETE /api/messages/:messageId
Authorization: Bearer <jwt_token>
```

### Room Endpoints

#### Create Room
```http
POST /api/rooms
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "General Chat",
  "description": "General discussion room",
  "isPrivate": false,
  "maxMembers": 100
}
```

#### Get User's Rooms
```http
GET /api/rooms
Authorization: Bearer <jwt_token>
```

#### Get Room Details
```http
GET /api/rooms/:roomId
Authorization: Bearer <jwt_token>
```

#### Join Room
```http
POST /api/rooms/:roomId/join
Authorization: Bearer <jwt_token>
```

#### Leave Room
```http
POST /api/rooms/:roomId/leave
Authorization: Bearer <jwt_token>
```

#### Get Room Messages
```http
GET /api/rooms/:roomId/messages?page=1&limit=50
Authorization: Bearer <jwt_token>
```

## Socket.io Events

### Client to Server Events

#### Authentication
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

#### Send Direct Message
```javascript
socket.emit('send_message', {
  receiverId: 'user_id',
  content: 'Hello!',
  messageType: 'text'
});
```

#### Send Room Message
```javascript
socket.emit('send_room_message', {
  roomId: 'room_id',
  content: 'Hello everyone!',
  messageType: 'text',
  replyTo: 'message_id' // optional
});
```

#### Typing Indicators
```javascript
// Direct message typing
socket.emit('typing_start', { receiverId: 'user_id' });
socket.emit('typing_stop', { receiverId: 'user_id' });

// Room typing
socket.emit('room_typing_start', { roomId: 'room_id' });
socket.emit('room_typing_stop', { roomId: 'room_id' });
```

#### Join/Leave Room
```javascript
socket.emit('join_room', { roomId: 'room_id' });
socket.emit('leave_room', { roomId: 'room_id' });
```

#### Update Status
```javascript
socket.emit('update_status', { status: 'away' });
```

### Server to Client Events

#### New Messages
```javascript
socket.on('new_message', (message) => {
  console.log('New direct message:', message);
});

socket.on('new_room_message', (message) => {
  console.log('New room message:', message);
});
```

#### User Status Updates
```javascript
socket.on('user_online', (data) => {
  console.log(`${data.username} is now online`);
});

socket.on('user_offline', (data) => {
  console.log(`${data.username} went offline`);
});

socket.on('user_status_update', (data) => {
  console.log(`${data.username} status: ${data.status}`);
});
```

#### Typing Indicators
```javascript
socket.on('user_typing', (data) => {
  console.log(`${data.username} is typing...`);
});

socket.on('user_stop_typing', (data) => {
  console.log(`${data.username} stopped typing`);
});
```

## Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── middleware/
│   └── auth.js             # JWT authentication middleware
├── models/
│   ├── User.js             # User model
│   ├── Message.js          # Direct message model
│   ├── Room.js             # Chat room model
│   └── RoomMessage.js      # Room message model
├── routes/
│   ├── auth.js             # Authentication routes
│   ├── users.js            # User management routes
│   ├── messages.js         # Message routes
│   └── rooms.js            # Room management routes
├── socket/
│   └── socketHandlers.js   # Socket.io event handlers
├── .env                    # Environment variables
├── package.json            # Dependencies and scripts
├── server.js              # Main server file
└── README.md              # This file
```

## Error Handling

The application includes comprehensive error handling:

- **Validation Errors**: MongoDB schema validation
- **Authentication Errors**: JWT token validation
- **Authorization Errors**: Route protection
- **Socket Errors**: Real-time communication errors
- **Database Errors**: MongoDB connection and query errors

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure authentication tokens
- **Input Validation**: Mongoose schema validation
- **Rate Limiting**: Can be added with express-rate-limit
- **CORS Configuration**: Restricted to specific origins
- **Environment Variables**: Sensitive data protection

## Testing

You can test the API endpoints using tools like:
- **Postman**: Import the endpoints and test REST API
- **Socket.io Client**: Test real-time functionality
- **Thunder Client**: VS Code extension for API testing

## Health Check

```http
GET /health
```

Returns server status, uptime, and environment information.

## Deployment

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=your_production_mongodb_uri
JWT_SECRET=your_production_jwt_secret
PORT=5000
CLIENT_URL=https://your-frontend-domain.com
```

### Docker Deployment (Optional)
Create a `Dockerfile`:
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository or contact the development team.

---

**Happy Coding! 🚀**
