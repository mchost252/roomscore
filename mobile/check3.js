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
      JSXExpressionContainer(path) {
        let parentName = '';
        if (path.parent.openingElement) {
          if (path.parent.openingElement.name.type === 'JSXIdentifier') {
             parentName = path.parent.openingElement.name.name;
          } else if (path.parent.openingElement.name.type === 'JSXMemberExpression') {
             parentName = path.parent.openingElement.name.object.name + '.' + path.parent.openingElement.name.property.name;
          }
        }
        
        if (parentName && parentName !== 'Text' && parentName !== 'Animated.Text') {
           const type = path.node.expression.type;
           // If it's a string, number, or binary expression returning a string/number
           // Or logical expression '&&' where left could be a number (like length)
           if (type === 'StringLiteral' || type === 'NumericLiteral') {
              console.log(`${f}:${path.node.loc.start.line} -> Literal inside <${parentName}>`);
           }
           if (type === 'LogicalExpression' && path.node.expression.operator === '&&') {
              console.log(`${f}:${path.node.loc.start.line} -> && Expression inside <${parentName}>`);
           }
        }
      }
    });
  } catch (e) {
    console.error('Parse error in', f, e.message);
  }
});
