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

module.exports = mongoose.model('Room', roomSchema);
