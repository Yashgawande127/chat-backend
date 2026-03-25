const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const sampleBadges = [
  {
    type: 'early_adopter',
    name: 'Early Adopter',
    description: 'One of the first users to join the platform',
    icon: '🚀',
    color: '#8b5cf6'
  },
  {
    type: 'verified',
    name: 'Email Verified',
    description: 'Verified email address',
    icon: '✓',
    color: '#10b981'
  },
  {
    type: 'contributor',
    name: 'Community Contributor',
    description: 'Active member of the community',
    icon: '🌟',
    color: '#f59e0b'
  },
  {
    type: 'achievement',
    name: 'First Message',
    description: 'Sent your first message',
    icon: '💬',
    color: '#3b82f6'
  },
  {
    type: 'achievement',
    name: 'Social Butterfly',
    description: 'Added 10 users to favorites',
    icon: '🦋',
    color: '#ec4899'
  }
];

const seedBadges = async () => {
  try {
    // Find all users
    const users = await User.find({});
    
    console.log(`Found ${users.length} users`);
    
    for (const user of users) {
      // Add some random badges to each user
      const numberOfBadges = Math.floor(Math.random() * 3) + 1; // 1-3 badges
      const userBadges = [];
      
      for (let i = 0; i < numberOfBadges; i++) {
        const randomBadge = sampleBadges[Math.floor(Math.random() * sampleBadges.length)];
        
        // Check if user already has this badge
        const hasBadge = user.badges.some(badge => 
          badge.type === randomBadge.type && badge.name === randomBadge.name
        );
        
        if (!hasBadge) {
          userBadges.push({
            ...randomBadge,
            earnedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
          });
        }
      }
      
      if (userBadges.length > 0) {
        user.badges.push(...userBadges);
        await user.save();
        console.log(`Added ${userBadges.length} badges to user ${user.username}`);
      }
    }
    
    console.log('Badge seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding badges:', error);
    process.exit(1);
  }
};

seedBadges();
