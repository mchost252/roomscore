import { convertToModelMessages } from 'ai';

const history = [
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

// Translation logic
const translated = history.map(msg => {
  if (msg.role === 'assistant' && msg.parts) {
    const newParts = [];
    for (const p of msg.parts) {
      if (p.type === 'tool-invocation') {
        newParts.push({
          type: 'tool-call',
          toolCallId: p.toolInvocationId,
          toolName: p.toolName,
          args: p.args
        });
        if ('result' in p) {
          newParts.push({
            type: 'tool-result',
            toolCallId: p.toolInvocationId,
            toolName: p.toolName,
            result: p.result
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

console.log("Translated:", JSON.stringify(translated, null, 2));

try {
  const result = await convertToModelMessages(translated);
  console.log("Converted:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
