import { convertToModelMessages } from 'ai';

const history = [
  {
    "id": "1",
    "role": "user",
    "parts": [{ "type": "text", "text": "show my tasks" }]
  },
  {
    "id": "2",
    "role": "assistant",
    "content": "",
    "parts": [
      {
        "type": "tool-invocation",
        "toolInvocationId": "call_123",
        "toolName": "get_user_context",
        "args": { "scope": "personal" }
      },
      {
        "type": "tool-result",
        "toolInvocationId": "call_123",
        "toolName": "get_user_context",
        "result": { "context": "[TASK] Do dishes" }
      }
    ]
  },
  {
    "id": "3",
    "role": "assistant",
    "parts": [{ "type": "text", "text": "Here are your tasks: Do dishes." }]
  }
];

try {
  const result = await convertToModelMessages(history);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
