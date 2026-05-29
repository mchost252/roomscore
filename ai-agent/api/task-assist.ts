import { createGroq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const config = {
  runtime: 'edge',
};

export default async function POST(req: Request) {
  const { taskTitle, taskType, priority, clarifications, userProfile, notesContext } = await req.json();

  const systemPrompt = `
    You are Krios, a warm, practical AI assistant inside a habit-tracking app.
    Generate a personal, actionable brief for the task: "${taskTitle}".
    
    User profile: ${JSON.stringify(userProfile)}
    User notepad context: ${notesContext ? String(notesContext).slice(0, 1200) : 'none yet'}
    
    GUIDELINES:
    - Be specific to the exact task. No generic productivity advice.
    - Break the work into 3-5 practical steps the user can actually do today.
    - Define 3-4 measurable milestones.
    - Pick one real, relevant resource only when it genuinely helps.
    - Avoid military/tactical language.
  `;

  const result = await generateObject({
    model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
    schema: z.object({
      summary: z.string().describe('A 1-sentence tactical summary of the mission'),
      flow: z.array(z.object({
        step: z.number(),
        title: z.string(),
        detail: z.string(),
      })).describe('The step-by-step operational flow'),
      milestones: z.array(z.object({
        id: z.number(),
        label: z.string(),
        completed: z.boolean().default(false),
      })).describe('Key objectives to secure'),
      hook: z.string().describe('A high-energy tactical motivation phrase'),
      estimatedTime: z.string().describe('Estimated duration (e.g. 30m, 2h)'),
      category: z.string().describe('A single word tactical category'),
      resource: z.object({
        name: z.string(),
        url: z.string(),
        type: z.enum(['app', 'website', 'book', 'tool']),
        description: z.string(),
      }).nullable(),
    }),
    system: systemPrompt,
    prompt: `Analyze mission: "${taskTitle}" (Type: ${taskType}, Priority: ${priority}). Clarifications: ${JSON.stringify(clarifications)}`,
  });

  return new Response(JSON.stringify({ success: true, note: result.object }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
