const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const files = [...walkSync('app/(home)'), ...walkSync('components/room-detail'), ...walkSync('components/room-task-thread')];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    traverse(ast, {
      JSXText(pathNode) {
        const text = pathNode.node.value;
        if (text.trim().length > 0) {
          let parentName = '';
          if (pathNode.parent.openingElement) {
             if (pathNode.parent.openingElement.name.type === 'JSXIdentifier') {
                parentName = pathNode.parent.openingElement.name.name;
             } else if (pathNode.parent.openingElement.name.type === 'JSXMemberExpression') {
                parentName = pathNode.parent.openingElement.name.object.name + '.' + pathNode.parent.openingElement.name.property.name;
             }
          }
          if (parentName && parentName !== 'Text' && parentName !== 'Animated.Text' && parentName !== 'TextInput') {
            console.log(`${f}:${pathNode.node.loc.start.line} -> Text "${text.trim()}" inside <${parentName}>`);
          }
        }
      },
      JSXExpressionContainer(pathNode) {
        if (pathNode.parent.type !== 'JSXElement') return;
        let parentName = '';
        if (pathNode.parent.openingElement) {
          if (pathNode.parent.openingElement.name.type === 'JSXIdentifier') {
             parentName = pathNode.parent.openingElement.name.name;
          } else if (pathNode.parent.openingElement.name.type === 'JSXMemberExpression') {
             parentName = pathNode.parent.openingElement.name.object.name + '.' + pathNode.parent.openingElement.name.property.name;
          }
        }
        
        if (parentName && parentName !== 'Text' && parentName !== 'Animated.Text' && parentName !== 'TextInput') {
           const type = pathNode.node.expression.type;
           if (type === 'LogicalExpression' && pathNode.node.expression.operator === '&&') {
              console.log(`${f}:${pathNode.node.loc.start.line} -> && Expression inside <${parentName}>`);
           }
        }
      }
    });
  } catch (e) {
  }
});
