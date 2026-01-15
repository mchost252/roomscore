const moment = require('moment-timezone');

/**
 * Task Validation Service
 * Prevents gaming the system by validating task completions
 */

class TaskValidationService {
  /**
   * Check if a task completion is valid for streak/MVP counting
   * Rules:
   * 1. Task must have existed before the day started, OR
   * 2. Task must have been created at least X hours before completion
   * 
   * @param {Date} taskCreatedAt - When the task was created
   * @param {Date} completedAt - When the task was completed
   * @param {String} timezone - Room timezone (default: UTC)
   * @param {Number} minHoursGap - Minimum hours between creation and completion (default: 2)
   * @returns {Boolean} - Whether the task completion is valid
   */
  static isValidTaskCompletion(taskCreatedAt, completedAt, timezone = 'UTC', minHoursGap = 2) {
    if (!taskCreatedAt || !completedAt) {
      return false;
    }

    const created = moment(taskCreatedAt).tz(timezone);
    const completed = moment(completedAt).tz(timezone);
    const startOfCompletionDay = completed.clone().startOf('day');

    // Rule 1: Task existed before the day started
    if (created.isBefore(startOfCompletionDay)) {
      return true;
    }

    // Rule 2: Task created at least X hours before completion
    const hoursDiff = completed.diff(created, 'hours', true);
    if (hoursDiff >= minHoursGap) {
      return true;
    }

    // Invalid: Task was created and completed too quickly
    return false;
  }

  /**
   * Check if a task was completed on a specific date
   * @param {Date} completedAt - When the task was completed
   * @param {Date} targetDate - The date to check
   * @param {String} timezone - Room timezone
   * @returns {Boolean}
   */
  static wasCompletedOnDate(completedAt, targetDate, timezone = 'UTC') {
    if (!completedAt || !targetDate) {
      return false;
    }

    const completed = moment(completedAt).tz(timezone);
    const target = moment(targetDate).tz(timezone);

    return completed.isSame(target, 'day');
  }

  /**
   * Get start and end of a specific day in a timezone
   * @param {Date} date - The date
   * @param {String} timezone - Timezone
   * @returns {Object} - { start: Date, end: Date }
   */
  static getDayBoundaries(date, timezone = 'UTC') {
    const momentDate = moment(date).tz(timezone);
    return {
      start: momentDate.clone().startOf('day').toDate(),
      end: momentDate.clone().endOf('day').toDate()
    };
  }

  /**
   * Check if user completed at least one valid task yesterday
   * @param {Array} tasks - Array of task completion records
   * @param {String} timezone - Timezone
   * @returns {Boolean}
   */
  static hasValidTasksYesterday(tasks, timezone = 'UTC') {
    const yesterday = moment().tz(timezone).subtract(1, 'day');
    const { start, end } = this.getDayBoundaries(yesterday.toDate(), timezone);

    return tasks.some(task => {
      if (!task.isCompleted || !task.completedAt) return false;
      
      const completedAt = moment(task.completedAt).tz(timezone);
      const isYesterday = completedAt.isBetween(start, end, null, '[]');
      
      if (!isYesterday) return false;

      // Check if it's a valid completion
      return this.isValidTaskCompletion(task.createdAt, task.completedAt, timezone);
    });
  }

  /**
   * Check if user completed at least one valid task today
   * @param {Array} tasks - Array of task completion records
   * @param {String} timezone - Timezone
   * @returns {Boolean}
   */
  static hasValidTasksToday(tasks, timezone = 'UTC') {
    const today = moment().tz(timezone);
    const { start, end } = this.getDayBoundaries(today.toDate(), timezone);

    return tasks.some(task => {
      if (!task.isCompleted || !task.completedAt) return false;
      
      const completedAt = moment(task.completedAt).tz(timezone);
      const isToday = completedAt.isBetween(start, end, null, '[]');
      
      if (!isToday) return false;

      // Check if it's a valid completion
      return this.isValidTaskCompletion(task.createdAt, task.completedAt, timezone);
    });
  }

  /**
   * Count valid tasks completed on a specific date
   * @param {Array} tasks - Array of task completion records
   * @param {Date} date - The date to check
   * @param {String} timezone - Timezone
   * @returns {Number}
   */
  static countValidTasksOnDate(tasks, date, timezone = 'UTC') {
    const { start, end } = this.getDayBoundaries(date, timezone);

    return tasks.filter(task => {
      if (!task.isCompleted || !task.completedAt) return false;
      
      const completedAt = moment(task.completedAt).tz(timezone);
      const isOnDate = completedAt.isBetween(start, end, null, '[]');
      
      if (!isOnDate) return false;

      // Check if it's a valid completion
      return this.isValidTaskCompletion(task.createdAt, task.completedAt, timezone);
    }).length;
  }
}

module.exports = TaskValidationService;
