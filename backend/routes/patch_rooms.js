const fs = require('fs');
const path = require('path');

const roomsPath = path.join(__dirname, 'rooms.js');
let roomsCode = fs.readFileSync(roomsPath, 'utf8');

const syncEndpoint = `
// @route   GET /api/rooms/:id/sync
// @desc    Delta sync for local-first room data
// @access  Private (must be member)
router.get('/:id/sync', protect, isRoomMember, async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const lastSyncStr = req.query.lastSync || '1970-01-01T00:00:00.000Z';
    const lastSyncDate = new Date(lastSyncStr);

    if (isNaN(lastSyncDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid lastSync timestamp' });
    }

    // Since tasks are relatively small, we sync all active tasks
    const tasks = await prisma.roomTask.findMany({
      where: { roomId }
    });

    // Get nodes (messages, proofs) since last sync
    const nodes = await prisma.roomTaskNode.findMany({
      where: {
        roomId,
        updatedAt: { gt: lastSyncDate }
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } }
      }
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      tasks,
      nodes
    });
  } catch (error) {
    next(error);
  }
});

`;

if (!roomsCode.includes('/api/rooms/:id/sync')) {
  roomsCode = roomsCode.replace(
    '// @route   GET /api/rooms/:id',
    syncEndpoint + '// @route   GET /api/rooms/:id'
  );
  fs.writeFileSync(roomsPath, roomsCode);
  console.log('Patched rooms.js with sync endpoint');
} else {
  console.log('Sync endpoint already exists');
}
