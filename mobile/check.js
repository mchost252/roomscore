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
          const parent = path.parent.name ? path.parent.name.name : 'unknown';
          if (parent !== 'Text' && parent !== 'Animated.Text') {
            console.log(`${f}:${path.node.loc.start.line} -> Text "${text.trim()}" inside <${parent}>`);
          }
        }
      },
      JSXExpressionContainer(path) {
        const parent = path.parent.name ? path.parent.name.name : 'unknown';
        if (parent !== 'Text' && parent !== 'Animated.Text' && parent !== 'unknown') {
          // If it's returning a string or number without a Text wrapper
          const isString = path.node.expression.type === 'StringLiteral';
          const isNumber = path.node.expression.type === 'NumericLiteral';
          if (isString || isNumber) {
            console.log(`${f}:${path.node.loc.start.line} -> Literal inside <${parent}>`);
          }
        }
      }
    });
  } catch (e) {
    console.error('Parse error in', f, e.message);
  }
});
