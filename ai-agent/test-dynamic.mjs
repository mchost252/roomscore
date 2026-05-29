import { convertToModelMessages } from 'ai';

const history = [
  {
    "id": "2",
    "role": "assistant",
    "parts": [
      {
        "type": "dynamic-tool",
        "toolCallId": "call_123",
        "toolName": "get_user_context",
        "input": { "scope": "personal" }
      },
      {
        "type": "dynamic-tool",
        "toolCallId": "call_123",
        "toolName": "get_user_context",
        "result": { "context": "Success" }
      }
    ]
  }
];

try {
  const result = await convertToModelMessages(history);
  console.log("Converted:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("Crash:", e.message);
}
