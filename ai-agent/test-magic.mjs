import { convertToModelMessages } from 'ai';

const history = [
  {
    "role": "assistant",
    "parts": [
      {
        "type": "tool-get_user_context",
        "toolCallId": "123",
        "args": { "scope": "personal" }
      },
      {
        "type": "tool-get_user_context",
        "toolCallId": "123",
        "result": { "context": "Success" }
      }
    ]
  }
];

try {
  const result = await convertToModelMessages(history);
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
