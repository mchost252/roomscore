const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  }
});

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  points: {
    type: Number,
    required: true,
    min: 1
  },
  category: {
    type: String,
    enum: ['health', 'productivity', 'learning', 'social', 'finance', 'other'],
    default: 'other'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'one-time'],
    required: true
  },
  daysOfWeek: [{
    type: Number,
    min: 0,
    max: 6
  }],
  deadline: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const pendingMemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  message: {
    type: String,
    trim: true,
    maxlength: 200
  }
});

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [memberSchema],
  pendingMembers: [pendingMemberSchema],
  tasks: [taskSchema],
  joinCode: {
    type: String,
    unique: true,
    default: () => nanoid(8).toUpperCase()
  },
  inviteLink: {
    type: String,
    unique: true,
    default: () => nanoid(16)
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  maxMembers: {
    type: Number,
    default: 50
  },
  // Room duration - defaults to 1 month from creation
  duration: {
    type: String,
    enum: ['1_week', '2_weeks', '1_month'],
    default: '1_month'
  },
  expiresAt: {
    type: Date,
    default: function() {
      const now = new Date();
      // Default to 1 month from now
      return new Date(now.setMonth(now.getMonth() + 1));
    }
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    allowMemberTaskCreation: {
      type: Boolean,
      default: false
    },
    messageRetentionDays: {
      type: Number,
      default: 30
    },
    requireApproval: {
      type: Boolean,
      default: false
    }
  },
  // Room streak tracking
  roomStreak: {
    type: Number,
    default: 0
  },
  longestRoomStreak: {
    type: Number,
    default: 0
  },
  lastRoomActivityDate: {
    type: Date,
    default: null
  },
  lastStreakCheckDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
roomSchema.index({ owner: 1 });
roomSchema.index({ joinCode: 1 });
roomSchema.index({ inviteLink: 1 });
roomSchema.index({ 'members.userId': 1 });

// Method to add member
roomSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(m => m.userId.toString() === userId.toString());
  if (existingMember) {
    throw new Error('User is already a member of this room');
  }
  
  if (this.members.length >= this.maxMembers) {
    throw new Error('Room has reached maximum capacity');
  }
  
  this.members.push({ userId, role, points: 0 });
  return this.save();
};

// Method to remove member
roomSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(m => m.userId.toString() !== userId.toString());
  return this.save();
};

// Method to update member points
roomSchema.methods.updateMemberPoints = function(userId, pointsToAdd) {
  const member = this.members.find(m => m.userId.toString() === userId.toString());
  if (member) {
    member.points += pointsToAdd;
    return this.save();
  }
  throw new Error('Member not found in room');
};

// Method to get leaderboard
roomSchema.methods.getLeaderboard = async function() {
  await this.populate('members.userId', 'username _id');
  
  return this.members
    .map(member => ({
      userId: member.userId._id,
      username: member.userId.username,
      avatar: member.userId.avatar,
      points: member.points,
      joinedAt: member.joinedAt
    }))
    .sort((a, b) => b.points - a.points);
};

// Method to add pending member (for approval-required rooms)
roomSchema.methods.addPendingMember = function(userId, message = '') {
  const existingPending = this.pendingMembers.find(m => m.userId.toString() === userId.toString());
  if (existingPending) {
    throw new Error('Already requested to join this room');
  }
  
  const existingMember = this.members.find(m => m.userId.toString() === userId.toString());
  if (existingMember) {
    throw new Error('Already a member of this room');
  }
  
  this.pendingMembers.push({ userId, message });
  return this.save();
};

// Method to approve pending member
roomSchema.methods.approvePendingMember = async function(userId) {
  const pendingIndex = this.pendingMembers.findIndex(m => m.userId.toString() === userId.toString());
  if (pendingIndex === -1) {
    throw new Error('User not found in pending members');
  }
  
  if (this.members.length >= this.maxMembers) {
    throw new Error('Room has reached maximum capacity');
  }
  
  // Remove from pending and add to members
  this.pendingMembers.splice(pendingIndex, 1);
  this.members.push({ userId, role: 'member', points: 0 });
  return this.save();
};

// Method to reject pending member
roomSchema.methods.rejectPendingMember = function(userId) {
  const pendingIndex = this.pendingMembers.findIndex(m => m.userId.toString() === userId.toString());
  if (pendingIndex === -1) {
    throw new Error('User not found in pending members');
  }
  
  this.pendingMembers.splice(pendingIndex, 1);
  return this.save();
};

// Static method to calculate expiry date from duration
roomSchema.statics.calculateExpiryDate = function(duration) {
  const now = new Date();
  switch (duration) {
    case '1_week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case '2_weeks':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case '1_month':
    default:
      return new Date(now.setMonth(now.getMonth() + 1));
  }
};

// Method to increment room streak
roomSchema.methods.incrementRoomStreak = function() {
  this.roomStreak += 1;
  if (this.roomStreak > this.longestRoomStreak) {
    this.longestRoomStreak = this.roomStreak;
  }
  this.lastRoomActivityDate = new Date();
  this.lastStreakCheckDate = new Date();
};

// Method to reset room streak
roomSchema.methods.resetRoomStreak = function() {
  this.roomStreak = 0;
  this.lastStreakCheckDate = new Date();
};

// Method to maintain room streak (keeps it alive)
roomSchema.methods.maintainRoomStreak = function() {
  this.lastRoomActivityDate = new Date();
  this.lastStreakCheckDate = new Date();
};

module.exports = mongoose.model('Room', roomSchema);
