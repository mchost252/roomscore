const mongoose = require('mongoose');

const dailyProgressSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  tasksCompleted: {
    type: Number,
    default: 0
  },
  pointsEarned: {
    type: Number,
    default: 0
  }
});

const userRoomProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastCompletionDate: {
    type: Date,
    default: null
  },
  weeklyProgress: {
    week: Number,
    year: Number,
    tasksCompleted: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 }
  },
  monthlyProgress: {
    month: Number,
    year: Number,
    tasksCompleted: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 }
  },
  dailyProgress: [dailyProgressSchema]
}, {
  timestamps: true
});

// Compound index for user-room combination
userRoomProgressSchema.index({ userId: 1, roomId: 1 }, { unique: true });

// Method to update progress
userRoomProgressSchema.methods.updateProgress = function(points, completionDate) {
  const today = new Date(completionDate);
  today.setHours(0, 0, 0, 0);
  
  // Update total points
  this.totalPoints += points;
  
  // Update streak
  if (this.lastCompletionDate) {
    const lastDate = new Date(this.lastCompletionDate);
    lastDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      this.currentStreak += 1;
    } else if (daysDiff > 1) {
      this.currentStreak = 1;
    }
  } else {
    this.currentStreak = 1;
  }
  
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  
  this.lastCompletionDate = completionDate;
  
  // Update daily progress
  const dailyEntry = this.dailyProgress.find(d => {
    const entryDate = new Date(d.date);
    entryDate.setHours(0, 0, 0, 0);
    return entryDate.getTime() === today.getTime();
  });
  
  if (dailyEntry) {
    dailyEntry.tasksCompleted += 1;
    dailyEntry.pointsEarned += points;
  } else {
    this.dailyProgress.push({
      date: today,
      tasksCompleted: 1,
      pointsEarned: points
    });
  }
  
  return this.save();
};

module.exports = mongoose.model('UserRoomProgress', userRoomProgressSchema);
