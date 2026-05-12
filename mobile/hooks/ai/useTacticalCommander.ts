import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { AI_AGENT_URL } from '../../constants/config';
import taskService from '../../services/taskService';
import { fetchAINote } from '../../services/aiNoteService';
import { secureStorage } from '../../services/storage';
import { TOKEN_KEY } from '../../constants/config';

/**
 * Helper to extract text content from a UIMessage
 */
export const getMessageText = (message: UIMessage): string => {
  if (!message.parts) return (message as any).content || '';
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => (part as any).text)
    .join('');
};

export function useTacticalCommander(roomId?: string, userId?: string, initialMessages: UIMessage[] = [], taskId?: string) {
  const [input, setInput] = useState('');
  
  const chatId = useMemo(() => {
    if (taskId) return `task-${taskId}`;
    if (roomId) return `room-${roomId}`;
    return 'personal-assistant';
  }, [roomId, taskId]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: AI_AGENT_URL,
    body: {
      roomId,
      userId,
      taskId,
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  }), [roomId, userId, taskId]);

  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    setMessages,
    addToolResult,
  } = useChat({
    id: chatId,
    transport,
    messages: initialMessages,
    experimental_throttle: 30,
    onError: (err) => {
      console.error('[KriosAssistant] Comms failure:', err);
    },
    onToolCall: async ({ toolCall }) => {
      const toolCallAny = toolCall as any;
      const toolName = toolCallAny.toolName;
      const toolCallId = toolCallAny.toolCallId;
      
      // Log the full raw shape so we can debug in dev
      console.log('[KriosAssistant] Raw toolCall:', JSON.stringify(toolCallAny, null, 2));
      
      // AI SDK v3 uses 'args', v6 uses 'input'. We check both.
      let args = toolCallAny.args || toolCallAny.input || {};
      
      // Guard: if args is a string (Groq sometimes stringifies), parse it
      if (typeof args === 'string') {
        try { args = JSON.parse(args); } catch { args = {}; }
      }
      
      console.log(`[KriosAssistant] Tool: ${toolName}, Args:`, JSON.stringify(args));
      
      let result;
      try {
        if (toolName === 'create_task') {
          // Safeguard against missing or malformed title
          const title = args.title || args.name || args.task;
          
          if (!title || title === 'undefined') {
            result = { status: 'ERROR', message: 'Missing title' };
          } else {
            if (roomId) {
              await taskService.createTask(roomId, { 
                title: String(title), 
                description: args.description || '', 
                points: args.points || 10 
              });
            } else {
              const createdTask = await taskService.createPersonalTask({ title: String(title) });
              
              // Fire-and-forget: pre-cache AI Note so it's ready when user views the task
              secureStorage.getItem(TOKEN_KEY).then(token => {
                if (token && createdTask.id) {
                  fetchAINote({
                    taskId: createdTask.id,
                    taskTitle: String(title),
                    token,
                    forceRefresh: false,
                  }).catch(err => console.warn('[KriosAssistant] AI Note pre-cache failed:', err));
                }
              }).catch(() => {});
            }
            result = { status: 'SUCCESS', message: 'Task created successfully locally' };
          }
        }
        
        else if (toolName === 'update_task') {
          const taskId = args.taskId || args.id;
          if (roomId) {
            // Room task updates aren't fully exposed in taskService here
          } else if (taskId) {
            await taskService.updatePersonalTask(taskId, { isCompleted: args.isCompleted, title: args.title });
          }
          result = { status: 'SUCCESS' };
        }
        
        else if (toolName === 'delete_task') {
          const taskId = args.taskId || args.id;
          if (!roomId && taskId) {
            await taskService.deletePersonalTask(taskId);
          }
          result = { status: 'SUCCESS' };
        }

        else if (toolName === 'get_user_context') {
          const scope = args.scope || (roomId ? 'room' : 'personal');
          if (scope === 'room' && roomId) {
            const tasks = await taskService.getTasks(roomId);
            const context = tasks.map((t: any) => `- "${t.title}" [${t.isCompleted ? 'Done' : 'Pending'}]`).join('\n');
            result = { context: context || 'No tasks in this room yet.', taskCount: tasks.length };
          } else {
            // Use getLocalTasks() to return ALL personal tasks, not just today's
            const allTasks = await taskService.getLocalTasks();
            const ongoing = allTasks.filter((t: any) => !t.isCompleted);
            const completed = allTasks.filter((t: any) => t.isCompleted);
            const lines = [
              `Ongoing (${ongoing.length}):`,
              ...ongoing.map((t: any) => `- [${t.id}] "${t.title}" (${t.priority || 'medium'} priority)`),
              `\nCompleted (${completed.length}):`,
              ...completed.map((t: any) => `- [${t.id}] "${t.title}"`),
            ];
            result = { context: lines.join('\n') || 'No personal tasks yet.', taskCount: allTasks.length };
          }
        }

        if (result && toolCallId) {
          addToolResult({ 
            toolCallId, 
            tool: toolName,
            state: 'output-available',
            output: result 
          });
        }
      } catch (e: any) {
        console.error('[KriosAssistant] Tool Error:', e.message);
        if (toolCallId) {
          addToolResult({ 
            toolCallId, 
            tool: toolName,
            state: 'output-error',
            errorText: e.message 
          });
        }
      }
    }
  });

  // Hydrate messages explicitly on mount if initialMessages is provided
  // This fixes the 'chat disappear when leaving screen' issue in React Native
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const sendCommand = useCallback(async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    await sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: msg }]
    });
  }, [input, sendMessage]);

  const deployQuery = useCallback(async (text: string) => {
    await sendMessage({
      role: 'user',
      parts: [{ type: 'text', text }]
    });
  }, [sendMessage]);

  return {
    commanderMessages: messages,
    commanderInput: input,
    updateCommanderInput: setInput,
    sendCommanderCommand: sendCommand,
    deployQuery,
    isCommanderWaiting: status === 'submitted',
    isCommanderLoading: status === 'submitted' || status === 'streaming',
    commanderError: error,
    reloadCommander: regenerate,
    stopCommander: stop,
  };
}
