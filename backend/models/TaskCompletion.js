const mongoose = require('mongoose');

const taskCompletionSchema = new mongoose.Schema({
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
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  taskTitle: {
    type: String,
    required: true
  },
  pointsAwarded: {
    type: Number,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  completionDate: {
    type: Date,
    required: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
taskCompletionSchema.index({ userId: 1, completionDate: -1 });
taskCompletionSchema.index({ roomId: 1, completionDate: -1 });
taskCompletionSchema.index({ taskId: 1, userId: 1, completionDate: 1 });

module.exports = mongoose.model('TaskCompletion', taskCompletionSchema);
