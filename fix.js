const fs = require('fs');
const content = fs.readFileSync('mobile/services/messageService.ts', 'utf8');
const toInsert = fs.readFileSync('insert_methods.ts', 'utf8');

const target = '  private async sendToServer(';
const parts = content.split(target);

if (parts.length === 2) {
  const newContent = parts[0] + toInsert + target + parts[1];
  fs.writeFileSync('mobile/services/messageService.ts', newContent);
  console.log('Fixed successfully!');
} else {
  console.log('Target not found exactly once. Found: ' + parts.length);
}
