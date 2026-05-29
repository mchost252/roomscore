import { convertToModelMessages } from 'ai';

const messages = [
  {
    "id": "1",
    "role": "user",
    "parts": [{ "type": "text", "text": "hello" }]
  },
  {
    "id": "2",
    "role": "assistant",
    "parts": [
      {
        "type": "tool-invocation",
        "toolInvocationId": "call_123",
        "toolName": "get_user_context",
        "args": { "scope": "personal" },
        "state": "result",
        "result": { "context": "Success" }
      }
    ]
  }
];

const safeMessages = messages.map(msg => {
  if (msg.role === 'assistant' && msg.parts) {
    const newParts = [];
    for (const p of msg.parts) {
      if (p.type === 'tool-invocation') {
        newParts.push({
          type: 'tool-call',
          toolCallId: p.toolInvocationId,
          toolName: p.toolName,
          input: p.args
        });
        if ('result' in p) {
          newParts.push({
            type: 'tool-result',
            toolCallId: p.toolInvocationId,
            toolName: p.toolName,
            output: p.result,
            isError: false
          });
        }
      } else {
        newParts.push(p);
      }
    }
    return { ...msg, parts: newParts };
  }
  return msg;
});

try {
  const result = await convertToModelMessages(safeMessages);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
