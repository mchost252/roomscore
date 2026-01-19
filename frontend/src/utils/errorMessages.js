/**
 * Krios Themed Error Messages
 * 
 * User-friendly, constellation-themed error messages
 * to replace technical error messages throughout the app.
 */

// Error types mapped to friendly messages
const ERROR_MESSAGES = {
  // Network & Connection Errors
  NETWORK_ERROR: {
    title: 'Lost in Space',
    message: 'We couldn\'t reach our servers. Please check your connection and try again.',
    icon: '🌌'
  },
  TIMEOUT: {
    title: 'Orbit Delayed',
    message: 'The stars are taking longer than usual to align. Please try again in a moment.',
    icon: '⏳'
  },
  ROOM_CREATION_TIMEOUT: {
    title: 'Orbit May Have Launched',
    message: 'The creation took longer than expected. Your room might already exist – check "My Rooms" to see if it appeared!',
    icon: '🚀'
  },
  SERVER_ERROR: {
    title: 'Cosmic Turbulence',
    message: 'Our servers hit a small asteroid. We\'re working on it – please try again shortly.',
    icon: '☄️'
  },
  RATE_LIMIT: {
    title: 'Slow Down, Star!',
    message: 'You\'re moving too fast through the cosmos. Take a breath and try again in a moment.',
    icon: '🌟'
  },

  // Authentication Errors
  UNAUTHORIZED: {
    title: 'Access Denied',
    message: 'Your orbit pass has expired. Please sign in again to continue your journey.',
    icon: '🔒'
  },
  SESSION_EXPIRED: {
    title: 'Session Drifted Away',
    message: 'Your session has floated into the void. Please sign in again.',
    icon: '🌙'
  },
  INVALID_CREDENTIALS: {
    title: 'Wrong Coordinates',
    message: 'That email or password doesn\'t match our records. Please check and try again, or sign up if you\'re new here!',
    icon: '🧭'
  },

  // Room Errors
  ROOM_NOT_FOUND: {
    title: 'Orbit Not Found',
    message: 'This orbit seems to have drifted away. It may have been disbanded or doesn\'t exist.',
    icon: '🔭'
  },
  ROOM_FULL: {
    title: 'Orbit at Capacity',
    message: 'This constellation has reached its maximum stars. Try joining another orbit!',
    icon: '✨'
  },
  ALREADY_MEMBER: {
    title: 'Already Aboard',
    message: 'You\'re already a member of this room! Check your "My Rooms" tab.',
    icon: '🛸'
  },
  JOIN_REQUEST_PENDING: {
    title: 'Request Sent',
    message: 'Your join request has been sent! The room owner will review it soon.',
    icon: '📨'
  },
  ROOM_EXPIRED: {
    title: 'Orbit Completed',
    message: 'This room\'s journey has ended. The stars have moved on to new adventures.',
    icon: '🌅'
  },
  ALREADY_MEMBER: {
    title: 'Already in Orbit',
    message: 'You\'re already part of this constellation! No need to join again.',
    icon: '🌟'
  },
  CREATE_ROOM_FAILED: {
    title: 'Orbit Creation Paused',
    message: 'We couldn\'t create your orbit right now. The cosmos needs a moment – please try again.',
    icon: '🛸'
  },

  // Task Errors
  TASK_NOT_FOUND: {
    title: 'Task Lost in Space',
    message: 'This task seems to have drifted away. It may have been removed.',
    icon: '📋'
  },
  TASK_ALREADY_COMPLETED: {
    title: 'Already Shining!',
    message: 'You\'ve already completed this task today. Keep up the stellar work!',
    icon: '⭐'
  },

  // User Errors
  USER_NOT_FOUND: {
    title: 'Star Not Found',
    message: 'We couldn\'t find this user in our galaxy.',
    icon: '👤'
  },

  // Validation Errors
  VALIDATION_ERROR: {
    title: 'Check Your Coordinates',
    message: 'Some information seems off. Please review and correct the highlighted fields.',
    icon: '📝'
  },
  INVALID_INPUT: {
    title: 'Invalid Data',
    message: 'Please check your input and make sure all required fields are filled correctly.',
    icon: '⚠️'
  },

  // Friend/Social Errors
  FRIEND_REQUEST_FAILED: {
    title: 'Connection Failed',
    message: 'We couldn\'t send your friend request. The signal got lost in space.',
    icon: '🤝'
  },
  ALREADY_FRIENDS: {
    title: 'Already Connected',
    message: 'You\'re already orbiting together! No need to send another request.',
    icon: '💫'
  },

  // Nudge Errors
  NUDGE_LIMIT_REACHED: {
    title: 'Nudge Limit Reached',
    message: 'You\'ve sent your daily nudge for this orbit. Try again tomorrow!',
    icon: '🔔'
  },
  NUDGE_NEED_TASK: {
    title: 'Complete a Task First',
    message: 'You need to complete at least one task today before you can nudge others. Lead by example! ⭐',
    icon: '📋'
  },
  CANNOT_NUDGE_SELF: {
    title: 'Self-Nudge Detected',
    message: 'You can\'t nudge yourself! Complete your tasks to inspire others.',
    icon: '😊'
  },

  // Appreciation Errors
  APPRECIATION_LIMIT: {
    title: 'Appreciation Limit',
    message: 'You\'ve shared all your appreciations for today. More will be available tomorrow!',
    icon: '💝'
  },
  CANNOT_APPRECIATE_SELF: {
    title: 'Nice Try!',
    message: 'You can\'t appreciate yourself. Share your love with other stars!',
    icon: '😄'
  },

  // Generic/Fallback
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected cosmic event occurred. Please try again or contact support if it persists.',
    icon: '🌀'
  },
  GENERIC_RETRY: {
    title: 'Temporary Disturbance',
    message: 'Something didn\'t go as planned. Please try again in a moment.',
    icon: '🔄'
  }
};

/**
 * Get a user-friendly error message based on the error type or axios error
 * @param {Error|string} error - The error object or error code string
 * @param {string} context - Optional context (e.g., 'room', 'task', 'auth')
 * @returns {Object} - { title, message, icon }
 */
export const getErrorMessage = (error, context = '') => {
  // Handle string messages from backend
  if (typeof error === 'string') {
    const lowerError = error.toLowerCase();
    
    // Check for specific backend messages
    if (lowerError.includes('invalid credentials') || lowerError.includes('wrong password')) {
      return ERROR_MESSAGES.INVALID_CREDENTIALS;
    }
    if (lowerError.includes('user not found') || lowerError.includes('no account')) {
      return {
        title: 'Account Not Found',
        message: 'No account exists with this email. Would you like to sign up instead?',
        icon: '👤'
      };
    }
    if (lowerError.includes('email already') || lowerError.includes('already registered') || lowerError.includes('already exists with this email') || lowerError.includes('exists with this email')) {
      return {
        title: 'Email Already Registered',
        message: 'An account with this email already exists. Try signing in instead.',
        icon: '📧'
      };
    }
    if (lowerError.includes('username already') || lowerError.includes('username taken') || lowerError.includes('already exists with this username') || lowerError.includes('exists with this username')) {
      return {
        title: 'Username Taken',
        message: 'This username is already in use. Please choose a different one.',
        icon: '👤'
      };
    }
    if (lowerError.includes('already a member') || lowerError.includes('already member')) {
      return ERROR_MESSAGES.ALREADY_MEMBER;
    }
    if (lowerError.includes('maximum capacity') || lowerError.includes('room is full')) {
      return ERROR_MESSAGES.ROOM_FULL;
    }
    if (lowerError.includes('expired') || lowerError.includes('no longer accepting')) {
      return ERROR_MESSAGES.ROOM_EXPIRED;
    }
    if (lowerError.includes('network') || lowerError.includes('cannot reach')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    
    // Check if it matches a known error code
    const upperError = error.toUpperCase().replace(/ /g, '_');
    if (ERROR_MESSAGES[upperError]) {
      return ERROR_MESSAGES[upperError];
    }
    
    return ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  // Handle Axios errors
  if (error?.isAxiosError || error?.code || error?.response) {
    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return ERROR_MESSAGES.TIMEOUT;
    }

    // Network errors (no response)
    if (error.code === 'ERR_NETWORK' || !error.response) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }

    // HTTP status-based errors
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message?.toLowerCase() || '';

    switch (status) {
      case 400:
        // Check for specific validation messages
        if (serverMessage.includes('already a member')) {
          return ERROR_MESSAGES.ALREADY_MEMBER;
        }
        if (serverMessage.includes('already friends')) {
          return ERROR_MESSAGES.ALREADY_FRIENDS;
        }
        if (serverMessage.includes('limit') && serverMessage.includes('nudge')) {
          return ERROR_MESSAGES.NUDGE_LIMIT_REACHED;
        }
        if (serverMessage.includes('complete') && serverMessage.includes('task') && serverMessage.includes('nudge')) {
          return ERROR_MESSAGES.NUDGE_NEED_TASK;
        }
        if (serverMessage.includes('must complete') && serverMessage.includes('task')) {
          return ERROR_MESSAGES.NUDGE_NEED_TASK;
        }
        if (serverMessage.includes('limit') && serverMessage.includes('appreciation')) {
          return ERROR_MESSAGES.APPRECIATION_LIMIT;
        }
        if (serverMessage.includes('expired')) {
          return ERROR_MESSAGES.ROOM_EXPIRED;
        }
        if (serverMessage.includes('already completed')) {
          return ERROR_MESSAGES.TASK_ALREADY_COMPLETED;
        }
        return ERROR_MESSAGES.VALIDATION_ERROR;

      case 401:
        return ERROR_MESSAGES.UNAUTHORIZED;

      case 403:
        // Check server message for specific 403 errors
        if (serverMessage.includes('must be a member') || serverMessage.includes('not a member')) {
          return {
            icon: '🚫',
            message: 'You are not a member of this orbit. Request to join or find another orbit to explore!'
          };
        }
        if (serverMessage.includes('pending approval') || serverMessage.includes('join request is pending')) {
          return {
            icon: '⏳',
            message: 'Your join request is pending approval from the orbit owner. Please wait for them to review it.'
          };
        }
        return ERROR_MESSAGES.UNAUTHORIZED;

      case 404:
        if (context === 'room' || serverMessage.includes('room')) {
          return ERROR_MESSAGES.ROOM_NOT_FOUND;
        }
        if (context === 'task' || serverMessage.includes('task')) {
          return ERROR_MESSAGES.TASK_NOT_FOUND;
        }
        if (context === 'user' || serverMessage.includes('user')) {
          return ERROR_MESSAGES.USER_NOT_FOUND;
        }
        return ERROR_MESSAGES.UNKNOWN_ERROR;

      case 429:
        return ERROR_MESSAGES.RATE_LIMIT;

      case 500:
      case 502:
      case 503:
      case 504:
        return ERROR_MESSAGES.SERVER_ERROR;

      default:
        return ERROR_MESSAGES.UNKNOWN_ERROR;
    }
  }

  // Fallback for other error types
  return ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Format error for display in UI
 * @param {Error|string} error - The error
 * @param {string} context - Optional context
 * @returns {string} - Formatted message string
 */
export const formatErrorMessage = (error, context = '') => {
  const { message } = getErrorMessage(error, context);
  return message;
};

/**
 * Get full error object for display (with icon and title)
 * @param {Error|string} error - The error
 * @param {string} context - Optional context  
 * @returns {Object} - { title, message, icon }
 */
export const getFullError = (error, context = '') => {
  return getErrorMessage(error, context);
};

// Export the error messages object for direct access if needed
export { ERROR_MESSAGES };

export default {
  getErrorMessage,
  formatErrorMessage,
  getFullError,
  ERROR_MESSAGES
};
