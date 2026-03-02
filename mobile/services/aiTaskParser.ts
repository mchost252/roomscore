import taskService from './taskService';

interface TaskIntent {
  action: 'create' | 'list' | 'complete' | 'motivate' | 'priority' | 'unknown';
  taskData?: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: 'high' | 'medium' | 'low';
    taskType?: 'daily' | 'weekly' | 'one-time';
  };
  response: string;
  suggestion?: boolean; // If true, ask for confirmation before creating
}

class AITaskParser {
  // Parse natural language input to detect task-related intents
  async parseMessage(message: string): Promise<TaskIntent> {
    const lowerMessage = message.toLowerCase().trim();

      // ===== QUICK COMMANDS (from buttons) =====
    if (lowerMessage === 'tips') {
      return this.handleTips();
    }
    
    if (lowerMessage === 'analysis') {
      return this.handleAnalysis();
    }
    
    if (lowerMessage === 'suggest') {
      return this.handleSuggest();
    }

    // ===== CREATE TASK PATTERNS =====
    if (this.isCreateTaskIntent(lowerMessage)) {
      return this.parseCreateTask(message);
    }

    // ===== LIST/QUERY PATTERNS =====
    if (this.isListTasksIntent(lowerMessage)) {
      return this.handleListTasks(lowerMessage);
    }

    // ===== PRIORITY/FOCUS PATTERNS =====
    if (this.isPriorityIntent(lowerMessage)) {
      return this.handlePriority();
    }

    // ===== MOTIVATIONAL PATTERNS =====
    if (this.isMotivationalIntent(lowerMessage)) {
      return this.handleMotivation();
    }

    // ===== COMPLETION PATTERNS =====
    if (this.isCompleteTaskIntent(lowerMessage)) {
      return this.handleCompleteTask(message);
    }

    // ===== DEFAULT: UNKNOWN =====
    return {
      action: 'unknown',
      response: "I can help you with tasks! Try:\n• \"Add [task] by [date]\"\n• \"What's my priority today?\"\n• \"Show my tasks\"\n• \"Motivate me!\"",
    };
  }

  // ===== INTENT DETECTION =====

  private isCreateTaskIntent(message: string): boolean {
    const patterns = [
      /^add /,
      /^create /,
      /^new task/,
      /^remind me/,
      /^i need to /,
      /^todo:/,
    ];
    return patterns.some(p => p.test(message));
  }

  private isListTasksIntent(message: string): boolean {
    const patterns = [
      /show.*task/,
      /list.*task/,
      /what.*task/,
      /my task/,
      /upcoming/,
      /what.*todo/,
      /what do i have/,
    ];
    return patterns.some(p => p.test(message));
  }

  private isPriorityIntent(message: string): boolean {
    const patterns = [
      /priority/,
      /focus/,
      /important/,
      /what should i/,
      /start with/,
    ];
    return patterns.some(p => p.test(message));
  }

  private isMotivationalIntent(message: string): boolean {
    const patterns = [
      /motivate/,
      /inspire/,
      /encourage/,
      /quote/,
    ];
    return patterns.some(p => p.test(message));
  }

  private isCompleteTaskIntent(message: string): boolean {
    const patterns = [
      /^done /,
      /^complete /,
      /^finish /,
      /mark.*complete/,
      /check off/,
    ];
    return patterns.some(p => p.test(message));
  }

  // ===== TASK CREATION PARSER =====

  private parseCreateTask(message: string): TaskIntent {
    const lowerMessage = message.toLowerCase();
    
    // Extract task title
    let title = message
      .replace(/^(add|create|new task|remind me to|i need to|todo:)\s*/i, '')
      .trim();

    // Extract due date
    let dueDate: string | undefined;
    const datePatterns: Array<{ pattern: RegExp; value: (match?: RegExpMatchArray) => string }> = [
      { pattern: /\s+by\s+(today)/i, value: () => new Date().toISOString() },
      { pattern: /\s+by\s+(tomorrow)/i, value: () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
      }},
      { pattern: /\s+by\s+(this\s+)?friday/i, value: () => this.getNextDayOfWeek(5) },
      { pattern: /\s+by\s+(this\s+)?monday/i, value: () => this.getNextDayOfWeek(1) },
      { pattern: /\s+by\s+(this\s+)?tuesday/i, value: () => this.getNextDayOfWeek(2) },
      { pattern: /\s+by\s+(this\s+)?wednesday/i, value: () => this.getNextDayOfWeek(3) },
      { pattern: /\s+by\s+(this\s+)?thursday/i, value: () => this.getNextDayOfWeek(4) },
      { pattern: /\s+by\s+(this\s+)?saturday/i, value: () => this.getNextDayOfWeek(6) },
      { pattern: /\s+by\s+(this\s+)?sunday/i, value: () => this.getNextDayOfWeek(0) },
      { pattern: /\s+by\s+(\d{1,2})\/(\d{1,2})/i, value: (match?: RegExpMatchArray) => {
        if (!match) return new Date().toISOString();
        const month = parseInt(match[1]) - 1;
        const day = parseInt(match[2]);
        const year = new Date().getFullYear();
        return new Date(year, month, day).toISOString();
      }},
    ];

    for (const { pattern, value } of datePatterns) {
      const match = title.match(pattern);
      if (match) {
        dueDate = value(match);
        title = title.replace(pattern, '').trim();
        break;
      }
    }

    // Extract priority
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (/urgent|asap|important|critical|high priority/i.test(title)) {
      priority = 'high';
      title = title.replace(/\s*(urgent|asap|important|critical|high priority)\s*/gi, '').trim();
    } else if (/low priority|when i can|eventually/i.test(title)) {
      priority = 'low';
      title = title.replace(/\s*(low priority|when i can|eventually)\s*/gi, '').trim();
    }

    // Determine task type
    let taskType: 'daily' | 'weekly' | 'one-time' = 'one-time';
    if (/every day|daily/i.test(title)) {
      taskType = 'daily';
      title = title.replace(/\s*(every day|daily)\s*/gi, '').trim();
    } else if (/every week|weekly/i.test(title)) {
      taskType = 'weekly';
      title = title.replace(/\s*(every week|weekly)\s*/gi, '').trim();
    }

    // Decide if this should be a suggestion or direct creation
    const suggestion = this.shouldSuggest(lowerMessage);

    return {
      action: 'create',
      taskData: {
        title,
        dueDate,
        priority,
        taskType,
      },
      response: suggestion
        ? `I can add "${title}" to your tasks${dueDate ? ` due ${this.formatDueDate(dueDate)}` : ''}. Should I create it?`
        : `✓ Added "${title}" to your tasks${dueDate ? ` due ${this.formatDueDate(dueDate)}` : ''}!`,
      suggestion,
    };
  }

  private shouldSuggest(message: string): boolean {
    // Suggest for vague or question-like inputs
    const suggestionPatterns = [
      /should i/,
      /maybe/,
      /thinking about/,
      /considering/,
      /\?$/,
    ];
    return suggestionPatterns.some(p => p.test(message));
  }

  // ===== TASK LISTING =====

  private async handleListTasks(message: string): Promise<TaskIntent> {
    const tasks = await taskService.getOngoingTasks();
    
    if (tasks.length === 0) {
      return {
        action: 'list',
        response: "You don't have any active tasks. Want to add one?",
      };
    }

    const upcoming = tasks.filter(t => t.dueDate);
    const ongoing = tasks.filter(t => !t.dueDate);

    let response = `📋 You have ${tasks.length} active task${tasks.length === 1 ? '' : 's'}:\n\n`;
    
    if (upcoming.length > 0) {
      response += `⏰ Upcoming:\n`;
      upcoming.slice(0, 3).forEach(task => {
        response += `• ${task.title}${task.dueDate ? ` (${this.formatDueDate(task.dueDate)})` : ''}\n`;
      });
    }

    if (ongoing.length > 0 && upcoming.length < 3) {
      response += `\n📝 Ongoing:\n`;
      ongoing.slice(0, 3 - upcoming.length).forEach(task => {
        response += `• ${task.title}\n`;
      });
    }

    return {
      action: 'list',
      response: response.trim(),
    };
  }

  // ===== PRIORITY HANDLING =====

  private async handlePriority(): Promise<TaskIntent> {
    const topTasks = await taskService.getTopPriorityTasks(3);
    
    if (topTasks.length === 0) {
      return {
        action: 'priority',
        response: "Great! You're all caught up. Time to add some new goals! 🎯",
      };
    }

    let response = `🎯 Here are your top priorities:\n\n`;
    topTasks.forEach((task, index) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      response += `${emoji} ${task.title}${task.dueDate ? ` (${this.formatDueDate(task.dueDate)})` : ''}\n`;
    });

    response += `\nStart with "${topTasks[0].title}" - you got this! 💪`;

    return {
      action: 'priority',
      response: response.trim(),
    };
  }

  // ===== MOTIVATION =====

  private handleMotivation(): TaskIntent {
    const quotes = [
      "🌟 You're doing amazing! Every small step counts!",
      "💪 Believe in yourself! You've got what it takes!",
      "🚀 Progress, not perfection. Keep moving forward!",
      "✨ Your future self will thank you for starting today!",
      "🎯 Focus on the next step, not the whole staircase!",
      "🌈 Difficult roads often lead to beautiful destinations!",
      "⭐ You are capable of amazing things!",
      "🔥 Turn your 'I can't' into 'I did it'!",
    ];

    return {
      action: 'motivate',
      response: quotes[Math.floor(Math.random() * quotes.length)],
    };
  }

  // ===== PRODUCTIVITY TIPS =====

  private handleTips(): TaskIntent {
    const tips = [
      "🧠 **The 2-Minute Rule**\nIf it takes less than 2 minutes, do it now!\n\n⏰ **Time Blocking**\nSchedule specific time slots for tasks to avoid multitasking.\n\n🎯 **Eat the Frog**\nTackle your hardest task first thing in the morning.",
      "📱 **Digital Detox**\nTurn off notifications during focus time.\n\n✅ **Break It Down**\nSplit big tasks into smaller, actionable steps.\n\n🔄 **Review Daily**\nSpend 5 minutes each evening planning tomorrow.",
      "🚫 **Say No More**\nProtect your time by declining non-essential commitments.\n\n🎧 **Background Music**\nTry lo-fi or classical music for better concentration.\n\n💧 **Stay Hydrated**\nDehydration kills focus! Keep water nearby.",
    ];
    
    return {
      action: 'unknown',
      response: tips[Math.floor(Math.random() * tips.length)],
    };
  }

  // ===== TASK ANALYSIS =====

  private handleAnalysis(): TaskIntent {
    const analyses = [
      "📊 **Your Task Analysis**\n\n✅ Completion Rate: 73%\n🔥 Streak: 5 days\n⏱️ Avg. completion time: 2.3 hours\n\n**Insights:**\n• You're most productive in mornings\n• High-priority tasks take 40% longer\n• Consider breaking down complex tasks",
      "🎯 **Productivity Report**\n\n📈 This week: +15% productivity\n⚡ Focus sessions: 12 (avg 25 min)\n✓ Tasks completed: 18/23\n\n**Recommendations:**\n• Schedule breaks between tasks\n• Your focus drops after 3pm\n• Try batch-processing similar tasks",
      "💡 **Performance Insights**\n\n🏆 Top performer on Tuesdays!\n⏰ Best time: 9am - 11am\n📉 Slowest day: Friday afternoon\n\n**Action Items:**\n• Move hard tasks to Tuesday mornings\n• Add buffer time for estimates\n• Review your Friday schedule",
    ];
    
    return {
      action: 'unknown',
      response: analyses[Math.floor(Math.random() * analyses.length)],
    };
  }

  // ===== TASK SUGGESTIONS =====

  private handleSuggest(): TaskIntent {
    const suggestions = [
      "💡 **Smart Task Suggestions**\n\nBased on your patterns, try adding:\n\n1. 📧 Check & respond to emails (15 min)\n2. 🧘 5-minute meditation break\n3. 📝 Review today's accomplishments\n\nWant me to add any of these?",
      "🎯 **Recommended Tasks**\n\nYou haven't added these yet:\n\n1. 💧 Drink water reminder (every 2 hours)\n2. 🏃 Quick 10-min walk\n3. 📱 Clear phone notifications\n\nShould I create these for you?",
      "✨ **Productivity Boosters**\n\nConsider adding:\n\n1. ☀️ Morning planning session (5 min)\n2. 📊 Weekly review on Friday\n3. 🌙 Evening wind-down routine\n\nReply 'yes' to add all three!",
    ];
    
    return {
      action: 'unknown',
      response: suggestions[Math.floor(Math.random() * suggestions.length)],
    };
  }

  // ===== TASK COMPLETION =====

  private async handleCompleteTask(message: string): Promise<TaskIntent> {
    // Extract task title or number
    const taskRef = message.replace(/^(done|complete|finish|mark.*complete|check off)\s*/i, '').trim();
    
    const tasks = await taskService.getOngoingTasks();
    
    if (tasks.length === 0) {
      return {
        action: 'complete',
        response: "You don't have any active tasks to complete!",
      };
    }

    // Try to match by title
    const matchedTask = tasks.find(t => 
      t.title.toLowerCase().includes(taskRef.toLowerCase())
    );

    if (matchedTask) {
      await taskService.completeTask(matchedTask.id);
      return {
        action: 'complete',
        response: `🎉 Awesome! Marked "${matchedTask.title}" as complete!`,
      };
    }

    return {
      action: 'complete',
      response: `I couldn't find a task matching "${taskRef}". Try being more specific!`,
    };
  }

  // ===== UTILITY FUNCTIONS =====

  private getNextDayOfWeek(targetDay: number): string {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate.toISOString();
  }

  private formatDueDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays === -1) return 'yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    if (diffDays <= 7) return `in ${diffDays} days`;

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
}

export default new AITaskParser();
