import { convertToModelMessages } from 'ai';

const messages = [
  {
    "role": "assistant",
    "parts": [
      {
        "type": "tool-invocation",
        "toolInvocationId": "call_123",
        "toolName": "get_user_context"
      },
      {
        "type": "tool-result",
        "toolInvocationId": "call_123",
        "toolName": "get_user_context",
        "result": { "context": "Success" }
      },
      { "type": "text", "text": "Here are your tasks." }
    ]
  }
];

const safeMessages = messages.map(msg => {
  if (msg.role === 'assistant' && msg.parts) {
    const newParts = msg.parts.filter(p => p.type !== 'tool-invocation' && p.type !== 'tool-result' && p.type !== 'tool-call');
    return { ...msg, parts: newParts };
  }
  return msg;
});

try {
  const result = await convertToModelMessages(safeMessages);
  console.log("Converted:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
