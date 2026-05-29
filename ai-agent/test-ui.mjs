import { convertToModelMessages } from 'ai';

const history = [
  {
    "role": "assistant",
    "parts": [{ "type": "tool-call", "toolCallId": "123", "toolName": "get_user_context", "args": {} }]
  },
  {
    "role": "tool",
    "parts": [{ "type": "tool-result", "toolCallId": "123", "toolName": "get_user_context", "result": {} }]
  }
];

try {
  const result = await convertToModelMessages(history);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
