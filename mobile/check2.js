const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const files = [
  'app/(home)/room-detail.tsx',
  'components/room-detail/TaskFolder.tsx',
  'components/room-detail/StatsGrid.tsx',
  'components/room-detail/MissionBriefModal.tsx'
];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    traverse(ast, {
      JSXText(path) {
        const text = path.node.value;
        if (text.trim().length > 0) {
          let parentName = '';
          if (path.parent.openingElement.name.type === 'JSXIdentifier') {
             parentName = path.parent.openingElement.name.name;
          } else if (path.parent.openingElement.name.type === 'JSXMemberExpression') {
             parentName = path.parent.openingElement.name.object.name + '.' + path.parent.openingElement.name.property.name;
          }
          if (parentName !== 'Text' && parentName !== 'Animated.Text') {
            console.log(`${f}:${path.node.loc.start.line} -> Text "${text.trim()}" inside <${parentName}>`);
          }
        }
      }
    });
  } catch (e) {
    console.error('Parse error in', f, e.message);
  }
});
