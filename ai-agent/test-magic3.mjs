import { convertToModelMessages } from 'ai';

const messages = [
  {
    "role": "assistant",
    "parts": [
      {
        "type": "tool-invocation",
        "toolInvocationId": "call_123",
        "toolName": "get_user_context",
        "args": { "scope": "personal" },
        "result": { "context": "Success" }
      }
    ]
  }
];

const safeMessages = [];
for (const msg of messages) {
  if (msg.role === 'assistant' && msg.parts) {
    const assistantParts = [];
    const toolParts = [];
    for (const p of msg.parts) {
      if (p.type === 'tool-invocation') {
        assistantParts.push({
          type: `tool-${p.toolName}`,
          toolCallId: p.toolInvocationId,
          input: p.args
        });
        if ('result' in p) {
          toolParts.push({
            type: "tool-result",
            toolCallId: p.toolInvocationId,
            toolName: p.toolName,
            output: p.result
          });
        }
      } else {
        assistantParts.push(p);
      }
    }
    safeMessages.push({ ...msg, parts: assistantParts });
    if (toolParts.length > 0) {
      safeMessages.push({ role: 'tool', parts: toolParts, content: [] });
    }
  } else {
    safeMessages.push(msg);
  }
}

try {
  const result = await convertToModelMessages(safeMessages);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
