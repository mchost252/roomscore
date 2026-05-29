import { createGroq } from '@ai-sdk/groq';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const prisma = new PrismaClient();

export const config = {
  runtime: 'edge',
};

export default async function POST(req: Request) {
  const { messages, roomId, userId, taskId } = await req.json();

  // 1. Fetch Room & User Context for System Prompt
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, aiProfile: true } });
  
  let roomName = 'Personal Space';
  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    if (room) roomName = room.name;
  }

  // 2. Fetch specific task context if provided
  let taskContext = '';
  if (taskId) {
    const roomTask = await prisma.roomTask.findUnique({ where: { id: taskId } });
    const personalTask = await prisma.personalTask.findUnique({ where: { id: taskId } });
    const t = roomTask || personalTask;
    if (t) {
      taskContext = `
        CURRENT MISSION FOCUS: "${t.title}"
        DESCRIPTION: ${t.description || 'NO SPEC PROVIDED'}
        STATUS: ${t.isCompleted ? 'SECURED' : 'ACTIVE'}
        POINTS: ${t.points || 0}
      `;
    }
  }

  const systemPrompt = `
    YOU ARE KRIOS — THE TACTICAL ARCHIVE COMMANDER.
    YOUR MISSION: Assist ${user?.username || 'Unknown Operator'} in their ${roomId ? \`Room: ${roomName}\` : 'Personal Space'}.
    ${taskContext}

    COMMANDER PROTOCOL (STYLING):
    - BE MINIMALIST, PROFESSIONAL, AND STRATEGIC.
    - USE ALL-CAPS ONLY FOR SYSTEM TERMS AND OBJECTIVES.
    - USE MONOSPACED SYMBOLS [ > | + | ! ] TO STRUCTURE DATA.
    - YOUR TONE IS AN ELITE ANALYTICAL AI — CALM, PRECISE, AND EMPOWERING.

    CORE CAPABILITIES:
    - DEPLOY_MISSION: CREATE TASKS.
    - GET_INTEL: SUMMARIZE ARCHIVE STATUS.
    - ANALYZE_PROGRESS: PROVIDE STRATEGIC ADVICE ON MISSIONS.

    WHEN A USER ASKS TO "ADD", "CREATE", OR "SET" A TASK, USE THE 'deploy_mission' TOOL.
    IF THEY ASK ABOUT THEIR PROGRESS OR HOW TO DO SOMETHING, USE 'get_intel' FOR CONTEXT.
  `;

  const result = await streamText({
    model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
    messages,
    system: systemPrompt,
    tools: {
      deploy_mission: tool({
        description: 'Deploy a new mission (task) to the archive',
        parameters: z.object({
          title: z.string().describe('The name of the mission'),
          description: z.string().describe('Operational details'),
          points: z.number().default(10),
          isPersonal: z.boolean().default(!roomId).describe('Whether this is a personal task or room task'),
        }),
        execute: async ({ title, description, points, isPersonal }) => {
          try {
            // For Personal Tasks, use the existing Express personal task route or direct Prisma
            if (isPersonal || !roomId) {
              const task = await prisma.personalTask.create({
                data: {
                  userId,
                  title: title.toUpperCase(),
                  description: description || '',
                  points: points || 10,
                  isActive: true,
                },
              });
              return { status: 'PERSONAL_MISSION_DEPLOYED', taskId: task.id };
            }

            // Room Task deployment via internal route
            const resp = await fetch(`${process.env.BACKEND_URL}/api/internal/tasks/deploy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.INTERNAL_SECRET || '',
              },
              body: JSON.stringify({ roomId, userId, title, description, points }),
            });
            const data = await resp.json();
            return { status: 'ROOM_MISSION_DEPLOYED', taskId: data.task?.id };
          } catch (e) {
            console.error('[AI-Agent] deploy failed:', e);
            return { status: 'ERROR', message: 'COMM_LINK_FAILURE' };
          }
        },
      }),
      get_intel: tool({
        description: 'Retrieve tactical intelligence from the archive',
        parameters: z.object({
          scope: z.enum(['room', 'personal']).default(roomId ? 'room' : 'personal'),
        }),
        execute: async ({ scope }) => {
          if (scope === 'room' && roomId) {
            const recentNodes = await prisma.roomTaskNode.findMany({
              where: { roomId },
              take: 15,
              orderBy: { createdAt: 'desc' },
              include: { user: { select: { username: true } } }
            });
            const intel = recentNodes.map(n => `[${n.user?.username || 'SYSTEM'}] ${n.type}: ${n.content || 'MEDIA_UPLOAD'}`).join('\n');
            return { intel: intel || 'ARCHIVE_EMPTY' };
          } else {
            const recentTasks = await prisma.personalTask.findMany({
              where: { userId },
              take: 10,
              orderBy: { createdAt: 'desc' }
            });
            const intel = recentTasks.map(t => `[TASK] ${t.title}: ${t.isCompleted ? 'SECURED' : 'ACTIVE'}`).join('\n');
            return { intel: intel || 'PERSONAL_ARCHIVE_EMPTY' };
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
