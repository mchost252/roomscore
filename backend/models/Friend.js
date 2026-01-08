const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
  // User who sent the friend request
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // User who received the friend request
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Status: 'pending', 'accepted', 'rejected'
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate friend requests
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Index for efficient queries - covers $or queries for friend lists
friendSchema.index({ requester: 1, status: 1 });
friendSchema.index({ recipient: 1, status: 1 });
// Compound index for faster $or queries when getting accepted friends
friendSchema.index({ status: 1, requester: 1 });
friendSchema.index({ status: 1, recipient: 1 });

module.exports = mongoose.model('Friend', friendSchema);
