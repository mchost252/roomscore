const fs = require('fs');
const path = require('path');

const filesToFix = [
  'app/(home)/rooms.tsx',
  'app/(home)/room/[id].tsx',
  'app/(home)/room-thread/[id].tsx',
  'components/room/RoomOperationCard.tsx',
  'components/room/RoomTaskFolder.tsx',
  'components/room/RoomTaskFolderList.tsx',
  'components/room/RoomDualFlipHeader.tsx',
  'components/room/RoomSubwayTimeline.tsx',
  'components/room/RoomProofCard.tsx'
];

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');

    // Replace import
    content = content.replace(/import \{ useRoomTheme \} from '.*theme';/g, "import { useTheme } from '../../context/ThemeContext';");
    content = content.replace(/import \{ useRoomTheme \} from '\.\/theme';/g, "import { useTheme } from '../../context/ThemeContext';");
    
    // Some components are inside components/room so relative path is just '../context/ThemeContext' or '../../context/ThemeContext' depending on depth
    // Let's just fix it globally by looking at the depth
    if (file.includes('components/room')) {
      content = content.replace(/import \{ useTheme \} from '\.\.\/\.\.\/context\/ThemeContext';/g, "import { useTheme } from '../../context/ThemeContext';");
    }

    // Replace hook call
    content = content.replace(/const theme = useRoomTheme\(\);/g, "const theme = useTheme();");

    // Replace properties
    content = content.replace(/theme\.colors\.background/g, "theme.colors.bg");
    content = content.replace(/theme\.colors\.card/g, "theme.colors.surface");
    content = content.replace(/theme\.colors\.border/g, "theme.colors.borderColor");
    content = content.replace(/theme\.colors\.subtext/g, "theme.colors.textSecondary");
    content = content.replace(/theme\.colors\.tabUnselected/g, "theme.colors.surfaceElevated");

    fs.writeFileSync(fullPath, content);
    console.log(`Fixed theme in ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
