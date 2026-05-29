import { convertToModelMessages } from 'ai';

const messages = [{"role":"user","content":"hello"}];

const safeMessages = messages.map(msg => {
  if (msg.role === 'user' && !msg.parts && msg.content) {
    return { ...msg, parts: [{ type: 'text', text: msg.content }] };
  }
  return msg;
});

console.log("Safe:", JSON.stringify(safeMessages));

try {
  console.log(convertToModelMessages(safeMessages));
} catch (e) { console.error("Failed:", e.message); }
