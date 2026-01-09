const Joi = require('joi');

// Validate request body against schema
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    next();
  };
};

// Auth schemas
exports.registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  username: Joi.string().min(3).max(30).required()
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

exports.updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(30),
  avatar: Joi.string().uri().allow(null, ''),
  bio: Joi.string().max(500).allow(''),
  notificationSettings: Joi.object({
    taskReminders: Joi.boolean(),
    roomActivity: Joi.boolean(),
    achievements: Joi.boolean()
  })
});

// Room schemas
exports.createRoomSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  description: Joi.string().max(500).allow(''),
  isPublic: Joi.boolean(),
  maxMembers: Joi.number().min(2).max(100),
  duration: Joi.string().valid('1_week', '2_weeks', '1_month'),
  requireApproval: Joi.boolean(),
  settings: Joi.object({
    timezone: Joi.string(),
    allowMemberTaskCreation: Joi.boolean(),
    messageRetentionDays: Joi.number().min(1).max(365),
    requireApproval: Joi.boolean()
  })
});

exports.updateRoomSchema = Joi.object({
  name: Joi.string().min(3).max(50),
  description: Joi.string().max(500).allow(''),
  isPublic: Joi.boolean(),
  maxMembers: Joi.number().min(2).max(100),
  settings: Joi.object({
    timezone: Joi.string(),
    allowMemberTaskCreation: Joi.boolean(),
    messageRetentionDays: Joi.number().min(1).max(365),
    requireApproval: Joi.boolean()
  })
});

exports.joinRoomSchema = Joi.object({
  joinCode: Joi.string(),
  inviteLink: Joi.string()
}).or('joinCode', 'inviteLink');

// Task schemas
exports.createTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).allow(''),
  points: Joi.number().min(1).max(1000).required(),
  category: Joi.string().valid('health', 'productivity', 'learning', 'social', 'finance', 'other'),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'one-time').required(),
  daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)),
  deadline: Joi.date().iso()
});

exports.updateTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100),
  description: Joi.string().max(500).allow(''),
  points: Joi.number().min(1).max(1000),
  category: Joi.string().valid('health', 'productivity', 'learning', 'social', 'finance', 'other'),
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'one-time'),
  daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)),
  deadline: Joi.date().iso(),
  isActive: Joi.boolean()
});

// Chat schema
exports.sendMessageSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required()
});

module.exports.validate = validate;
