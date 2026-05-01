const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { setIO } = require('../socket/io');

/**
 * Internal API — High-level actions triggered by the AI Agent
 * Protected by INTERNAL_SECRET header.
 */

const authenticateInternal = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized internal access' });
  }
  next();
};

router.post('/tasks/deploy', authenticateInternal, async (req, res, next) => {
  const { roomId, userId, title, description, points } = req.body;

  try {
    const task = await prisma.roomTask.create({
      data: {
        roomId,
        title: title.toUpperCase(),
        description: description || '',
        points: points || 10,
        createdBy: userId,
        isActive: true,
      },
    });

    // Emit socket event so mobile apps see it instantly
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('task:created', {
        roomId,
        task: { ...task, _id: task.id }
      });
    }

    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
