const Joi = require('joi');

// Images stored by the API must be hosted by Cloudinary.  In particular, do
// not allow data URIs, which can make database rows and socket payloads huge.
const cloudinaryUrl = Joi.string().custom((value, helpers) => {
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/.+/i.test(value)) return value;
  return helpers.error('string.cloudinaryUrl');
}).messages({
  'string.cloudinaryUrl': '{{#label}} must be a secure Cloudinary URL'
});

// Validate request body against schema
const validate = (schema) => {
  return (req, res, next) => {
    // stripUnknown removes properties not defined in the schema (like 'id' sent by the frontend)
    // Coerced values (like '10' -> 10) are returned in the 'value' object.
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    
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
    
    // Crucial: overwrite req.body with the sanitized and type-cast values
    req.body = value;
    next();
  };
};

// Auth schemas
exports.registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  username: Joi.string().min(3).max(30).required(),
  timezone: Joi.string().allow('', null) // Auto-detected from browser
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  timezone: Joi.string().allow('', null) // Auto-detected from browser
});

exports.updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(30),
  avatar: cloudinaryUrl.allow(null, ''),
  coverImage: cloudinaryUrl.allow(null, ''),
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
  chatRetentionDays: Joi.number().min(1).max(5), // How long to keep chat messages
  coverImage: cloudinaryUrl.allow(null, ''),
  roomDp: cloudinaryUrl.allow(null, ''),
  tasks: Joi.array().items(Joi.object({
    title: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).allow('', null),
    points: Joi.number().min(1).max(10), // Points limited to 1-10
    taskType: Joi.string().valid('daily', 'custom', 'one-time', 'weekly'),
    frequency: Joi.string().valid('daily', 'custom', 'one-time', 'weekly'),
    daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)), // For custom frequency
    dueDate: Joi.date().iso().allow('', null),
    hasThread: Joi.boolean() // Owner opt-in: social thread enabled
  })),
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
  coverImage: cloudinaryUrl.allow(null, ''),
  roomDp: cloudinaryUrl.allow(null, ''),
  settings: Joi.object({
    timezone: Joi.string(),
    allowMemberTaskCreation: Joi.boolean(),
    messageRetentionDays: Joi.number().min(1).max(365),
    requireApproval: Joi.boolean()
  })
});

exports.updateRoomDpSchema = Joi.object({
  roomDp: cloudinaryUrl.allow(null, '').required()
});

exports.updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'member').required()
});

exports.joinRoomSchema = Joi.object({
  joinCode: Joi.string(),
  roomId: Joi.string(),
  inviteLink: Joi.string()
}).or('joinCode', 'roomId', 'inviteLink');

// Task schemas
exports.createTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  points: Joi.number().min(1).max(10).required(), // Points limited to 1-10
  category: Joi.string().valid('health', 'productivity', 'learning', 'social', 'finance', 'other').allow('', null),
  frequency: Joi.string().valid('daily', 'custom', 'one-time', 'weekly').allow('', null),
  taskType: Joi.string().valid('daily', 'custom', 'one-time', 'weekly').allow('', null),
  daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).allow(null), // For custom frequency
  dueDate: Joi.date().iso().allow('', null),
  deadline: Joi.date().iso().allow('', null),
  hasThread: Joi.boolean() // Owner opt-in: social thread enabled
}).or('frequency', 'taskType'); // At least one of frequency or taskType must be present

exports.updateTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100),
  description: Joi.string().max(500).allow('', null),
  points: Joi.number().min(1).max(10), // Points limited to 1-10
  category: Joi.string().valid('health', 'productivity', 'learning', 'social', 'finance', 'other').allow('', null),
  frequency: Joi.string().valid('daily', 'custom', 'one-time', 'weekly').allow('', null),
  taskType: Joi.string().valid('daily', 'custom', 'one-time', 'weekly').allow('', null),
  daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)).allow(null), // For custom frequency
  dueDate: Joi.date().iso().allow('', null),
  deadline: Joi.date().iso().allow('', null),
  isActive: Joi.boolean(),
  hasThread: Joi.boolean() // Owner opt-in: social thread enabled
});

// Chat schema
exports.sendMessageSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  replyToId: Joi.string().allow(null, ''),
  replyToText: Joi.string().max(200).allow(null, '')
});

module.exports.validate = validate;
