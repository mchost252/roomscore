const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
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
  lastActiveDate: {
    type: Date,
    default: null
  },
  lastStreakCheckDate: {
    type: Date,
    default: null
  },
  streakFrozen: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notificationSettings: {
    taskReminders: {
      type: Boolean,
      default: true
    },
    roomActivity: {
      type: Boolean,
      default: true
    },
    achievements: {
      type: Boolean,
      default: true
    },
    pushEnabled: {
      type: Boolean,
      default: false
    }
  },
  pushSubscriptions: [{
    // Web push fields
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    },
    // Native push fields (FCM/APNS)
    nativeToken: String,
    platform: {
      type: String,
      enum: ['web', 'android', 'ios', 'unknown'],
      default: 'web'
    },
    userAgent: String,
    subscribedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ totalPoints: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.toPublicProfile = function() {
  return {
    id: this._id,
    email: this.email,
    username: this.username,
    avatar: this.avatar,
    bio: this.bio,
    totalPoints: this.totalPoints,
    currentStreak: this.currentStreak,
    longestStreak: this.longestStreak,
    isVerified: this.isVerified
  };
};

// Method to increment streak
userSchema.methods.incrementStreak = function() {
  this.currentStreak += 1;
  if (this.currentStreak > this.longestStreak) {
    this.longestStreak = this.currentStreak;
  }
  this.lastActiveDate = new Date();
  this.lastStreakCheckDate = new Date();
};

// Method to reset streak
userSchema.methods.resetStreak = function() {
  this.currentStreak = 0;
  this.lastStreakCheckDate = new Date();
};

// Method to maintain streak (keeps it alive without incrementing)
userSchema.methods.maintainStreak = function() {
  this.lastActiveDate = new Date();
  this.lastStreakCheckDate = new Date();
};

module.exports = mongoose.model('User', userSchema);
