import { convertToModelMessages } from 'ai';

try {
  console.log("1. Only content:");
  console.log(convertToModelMessages([{ role: 'user', content: 'hello' }]));
} catch (e) { console.error("1. Failed:", e.message); }

try {
  console.log("2. Only parts:");
  console.log(convertToModelMessages([{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }]));
} catch (e) { console.error("2. Failed:", e.message); }

try {
  console.log("3. Both content and parts:");
  console.log(convertToModelMessages([{ role: 'user', content: 'hello', parts: [{ type: 'text', text: 'hello' }] }]));
} catch (e) { console.error("3. Failed:", e.message); }

