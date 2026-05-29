import { convertToModelMessages } from 'ai';

const translated = [
  {
    "id": "2",
    "role": "assistant",
    "parts": [
      {
        "type": "tool-call",
        "toolCallId": "call_123",
        "toolName": "get_user_context",
        "input": { "scope": "personal" }
      },
      {
        "type": "tool-result",
        "toolCallId": "call_123",
        "toolName": "get_user_context",
        "result": { "context": "Success" }
      }
    ]
  }
];

try {
  const result = await convertToModelMessages(translated);
  console.log("Converted:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
