const mongoose = require('mongoose');

const appreciationSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['star', 'fire', 'shield'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes
appreciationSchema.index({ roomId: 1, toUserId: 1, type: 1 });
appreciationSchema.index({ roomId: 1, fromUserId: 1, date: 1 });

// Static method to get daily appreciation count for a user
appreciationSchema.statics.getDailyCount = async function(roomId, fromUserId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await this.countDocuments({
    roomId,
    fromUserId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  });
};

// Static method to check if user can give appreciation
appreciationSchema.statics.canGiveAppreciation = async function(roomId, fromUserId, dailyLimit = 3) {
  const count = await this.getDailyCount(roomId, fromUserId);
  return count < dailyLimit;
};

// Static method to get appreciation stats for a user in a room
appreciationSchema.statics.getUserStats = async function(roomId, userId) {
  const stats = await this.aggregate([
    {
      $match: {
        roomId: new mongoose.Types.ObjectId(roomId),
        toUserId: new mongoose.Types.ObjectId(userId)
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    star: 0,
    fire: 0,
    shield: 0,
    total: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

// Static method to record appreciation
appreciationSchema.statics.recordAppreciation = async function(roomId, fromUserId, toUserId, type) {
  // Check if already appreciated this user with this type today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const existing = await this.findOne({
    roomId,
    fromUserId,
    toUserId,
    type,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  });
  
  if (existing) {
    throw new Error('You have already given this appreciation today');
  }
  
  return await this.create({
    roomId,
    fromUserId,
    toUserId,
    type,
    date: new Date()
  });
};

module.exports = mongoose.model('Appreciation', appreciationSchema);
