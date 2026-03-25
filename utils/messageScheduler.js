const cron = require('node-cron');
const axios = require('axios');

class MessageScheduler {
  constructor() {
    this.isRunning = false;
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  }

  start() {
    if (this.isRunning) {
      console.log('Message scheduler is already running');
      return;
    }

    console.log('🕒 Starting Message Scheduler...');

    // Process scheduled messages every minute
    this.scheduledMessagesCron = cron.schedule('* * * * *', async () => {
      try {
        await this.processScheduledMessages();
      } catch (error) {
        console.error('Error in scheduled messages cron:', error);
      }
    });

    // Process due reminders every minute
    this.remindersCron = cron.schedule('* * * * *', async () => {
      try {
        await this.processDueReminders();
      } catch (error) {
        console.error('Error in reminders cron:', error);
      }
    });

    // Clean up old processed messages and reminders daily at 2 AM
    this.cleanupCron = cron.schedule('0 2 * * *', async () => {
      try {
        await this.cleanupOldRecords();
      } catch (error) {
        console.error('Error in cleanup cron:', error);
      }
    });

    this.isRunning = true;
    console.log('✅ Message Scheduler started successfully');
    console.log('   • Scheduled messages check: Every minute');
    console.log('   • Due reminders check: Every minute');
    console.log('   • Cleanup task: Daily at 2:00 AM');
  }

  stop() {
    if (!this.isRunning) {
      console.log('Message scheduler is not running');
      return;
    }

    console.log('🛑 Stopping Message Scheduler...');

    if (this.scheduledMessagesCron) {
      this.scheduledMessagesCron.destroy();
    }
    if (this.remindersCron) {
      this.remindersCron.destroy();
    }
    if (this.cleanupCron) {
      this.cleanupCron.destroy();
    }

    this.isRunning = false;
    console.log('✅ Message Scheduler stopped successfully');
  }

  async processScheduledMessages() {
    try {
      console.log('🔄 Processing scheduled messages...');
      
      // Make internal API call to process scheduled messages
      const response = await axios.post(`${this.baseUrl}/api/scheduled-messages/process`, {}, {
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || 'internal'}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const { results } = response.data;
      if (results.sent > 0 || results.failed > 0 || results.rescheduled > 0) {
        console.log(`📤 Scheduled messages processed:`, {
          sent: results.sent,
          failed: results.failed,
          rescheduled: results.rescheduled
        });
      }
    } catch (error) {
      if (error.response) {
        console.error('Error processing scheduled messages:', error.response.data);
      } else if (error.request) {
        console.error('No response received for scheduled messages processing');
      } else {
        console.error('Error setting up scheduled messages request:', error.message);
      }
    }
  }

  async processDueReminders() {
    try {
      console.log('🔔 Processing due reminders...');
      
      // Make internal API call to process due reminders
      const response = await axios.post(`${this.baseUrl}/api/message-reminders/process`, {}, {
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || 'internal'}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const { results } = response.data;
      if (results.processed > 0 || results.failed > 0 || results.rescheduled > 0) {
        console.log(`⏰ Due reminders processed:`, {
          processed: results.processed,
          failed: results.failed,
          rescheduled: results.rescheduled
        });
      }
    } catch (error) {
      if (error.response) {
        console.error('Error processing due reminders:', error.response.data);
      } else if (error.request) {
        console.error('No response received for due reminders processing');
      } else {
        console.error('Error setting up due reminders request:', error.message);
      }
    }
  }

  async cleanupOldRecords() {
    try {
      console.log('🧹 Running cleanup task...');
      
      const ScheduledMessage = require('../models/ScheduledMessage');
      const MessageReminder = require('../models/MessageReminder');

      // Delete old processed scheduled messages (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const deletedScheduledMessages = await ScheduledMessage.deleteMany({
        status: { $in: ['sent', 'failed', 'cancelled'] },
        updatedAt: { $lt: thirtyDaysAgo }
      });

      // Delete old processed reminders (older than 30 days)
      const deletedReminders = await MessageReminder.deleteMany({
        status: { $in: ['sent', 'dismissed'] },
        updatedAt: { $lt: thirtyDaysAgo }
      });

      console.log(`🗑️  Cleanup completed:`, {
        deletedScheduledMessages: deletedScheduledMessages.deletedCount,
        deletedReminders: deletedReminders.deletedCount
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledMessagesCron: this.scheduledMessagesCron ? 'active' : 'inactive',
      remindersCron: this.remindersCron ? 'active' : 'inactive',
      cleanupCron: this.cleanupCron ? 'active' : 'inactive'
    };
  }
}

// Create singleton instance
const messageScheduler = new MessageScheduler();

module.exports = messageScheduler;
