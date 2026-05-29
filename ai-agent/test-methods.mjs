import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const result = await streamText({
  model: createGroq({ apiKey: 'fake' })('meta-llama/llama-4-scout-17b-16e-instruct'),
  prompt: 'hello'
});

console.log(Object.keys(result));
