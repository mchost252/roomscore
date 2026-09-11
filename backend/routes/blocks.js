const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { prisma } = require('../config/database');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: req.user.id },
      include: { blocked: { select: { id: true, username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, blocks: blocks.map(block => ({ id: block.id, createdAt: block.createdAt, user: { ...block.blocked, _id: block.blocked.id } })) });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === req.user.id) return res.status(400).json({ success: false, message: 'A valid userId is required' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, avatar: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const block = await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: userId } },
      create: { blockerId: req.user.id, blockedId: userId },
      update: {},
    });
    const io = req.app.get('io');
    if (io) {
      const event = { userId: req.user.id, blockedUserId: userId };
      io.to(`user:${req.user.id}`).emit('user:blocked', event);
      io.to(`user:${userId}`).emit('user:blocked', event);
    }
    res.json({ success: true, block: { ...block, user: { ...user, _id: user.id } } });
  } catch (error) { next(error); }
});

async function unblock(req, res, next) {
  try {
    const userId = req.params.userId || req.body.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'A valid userId is required' });
    const result = await prisma.userBlock.deleteMany({ where: { blockerId: req.user.id, blockedId: userId } });
    if (result.count === 0) {
      return res.status(404).json({ success: false, message: 'Block record not found' });
    }
    const io = req.app.get('io');
    if (io) {
      const event = { userId: req.user.id, blockedUserId: userId };
      io.to(`user:${req.user.id}`).emit('user:unblocked', event);
      io.to(`user:${userId}`).emit('user:unblocked', event);
    }
    res.json({ success: true, message: 'User unblocked' });
  } catch (error) { next(error); }
}
router.delete('/', unblock);
router.delete('/:userId', unblock);

module.exports = router;
