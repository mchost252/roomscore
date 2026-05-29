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

const translated = [];
for (const msg of history) {
  if (msg.role === 'assistant' && msg.parts) {
    const assistantParts = [];
    const toolParts = [];
    for (const p of msg.parts) {
      if (p.type === 'tool-invocation') {
        assistantParts.push({
          type: "dynamic-tool",
          toolCallId: p.toolInvocationId,
          toolName: p.toolName,
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
    translated.push({ ...msg, parts: assistantParts });
    if (toolParts.length > 0) {
      translated.push({ role: 'tool', parts: toolParts, content: [] });
    }
  } else {
    translated.push(msg);
  }
}

console.log("Translated:", JSON.stringify(translated, null, 2));

try {
  const result = await convertToModelMessages(translated);
  console.log("Converted:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
