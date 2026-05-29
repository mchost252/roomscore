import { convertToModelMessages } from 'ai';

const history = [
  {
    "role": "assistant",
    "parts": [
      { "type": "tool-invocation", "toolInvocationId": "123", "toolName": "get_user_context", "args": {} },
      { "type": "tool-result", "toolInvocationId": "123", "toolName": "get_user_context", "result": {} }
    ]
  }
];

try {
  const result = await convertToModelMessages(history);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
