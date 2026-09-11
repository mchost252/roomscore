const { prisma } = require('../config/database');

async function isBlocked(userA, userB) {
  if (!userA || !userB) return false;
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

function blockedResponse(res) {
  return res.status(403).json({ success: false, code: 'USER_BLOCKED', message: 'This user is blocked' });
}

module.exports = { isBlocked, blockedResponse };
