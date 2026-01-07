const mongoose = require('mongoose');

const personalTaskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'one-time'],
    default: 'daily'
  },
  points: {
    type: Number,
    default: 10
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
personalTaskSchema.index({ userId: 1, isActive: 1 });
personalTaskSchema.index({ userId: 1, isCompleted: 1 });

module.exports = mongoose.model('PersonalTask', personalTaskSchema);
