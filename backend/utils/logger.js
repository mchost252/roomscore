const fs = require('fs');
const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

const transports = [];

if (isProduction) {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  }));
} else {
  try {
    const logDir = process.env.LOG_DIR || '.';
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    transports.push(new winston.transports.File({ filename: `${logDir}/error.log`, level: 'error' }));
    transports.push(new winston.transports.File({ filename: `${logDir}/combined.log` }));
  } catch (e) {
    console.warn('⚠️ File logging unavailable, falling back to console:', e.message);
  }
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'roomscore-api' },
  transports
});

module.exports = logger;
