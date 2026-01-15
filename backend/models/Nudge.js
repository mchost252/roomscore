const mongoose = require('mongoose');

const nudgeSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for checking daily limit
nudgeSchema.index({ roomId: 1, fromUserId: 1, date: 1 });

// Static method to check if user can send nudge today
nudgeSchema.statics.canSendNudge = async function(roomId, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nudgeToday = await this.findOne({
    roomId,
    fromUserId: userId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  });
  
  return !nudgeToday;
};

// Static method to record a nudge
nudgeSchema.statics.recordNudge = async function(roomId, userId) {
  return await this.create({
    roomId,
    fromUserId: userId,
    date: new Date()
  });
};

module.exports = mongoose.model('Nudge', nudgeSchema);
