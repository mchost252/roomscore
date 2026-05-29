const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

if (!schema.includes('RoomTaskNode')) {
  const roomNodeModel = `
// ==================== ROOM TASK NODE (Subway Timeline) ====================
model RoomTaskNode {
  id          String   @id @default(cuid())
  roomId      String
  taskId      String?
  userId      String?
  type        String   @default("MESSAGE") // MESSAGE, PROOF, SYSTEM_ALERT
  content     String?
  status      String   @default("PENDING") // PENDING, GHOST_APPROVED, VOUCHED, REJECTED
  vouchCount  Int      @default(0)
  mediaUrl    String?
  blurHash    String?
  heatLevel   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  room        Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  task        RoomTask? @relation(fields: [taskId], references: [id], onDelete: SetNull)
  user        User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([roomId])
  @@index([taskId])
  @@index([updatedAt])
}
`;

  schema += '\n' + roomNodeModel;
  
  // Add references
  schema = schema.replace(
    '  userRoomProgress      UserRoomProgress[]\n  mvpAwards             RoomMVP[]',
    '  userRoomProgress      UserRoomProgress[]\n  mvpAwards             RoomMVP[]\n  taskNodes             RoomTaskNode[]'
  );
  
  schema = schema.replace(
    '  userRoomProgress UserRoomProgress[]\n  mvpHistory      RoomMVP[]',
    '  userRoomProgress UserRoomProgress[]\n  mvpHistory      RoomMVP[]\n  taskNodes       RoomTaskNode[]'
  );

  schema = schema.replace(
    '  completions TaskCompletion[]',
    '  completions TaskCompletion[]\n  nodes       RoomTaskNode[]'
  );

  fs.writeFileSync(schemaPath, schema);
  console.log('Schema patched successfully.');
} else {
  console.log('Schema already contains RoomTaskNode.');
}
