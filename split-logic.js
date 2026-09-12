const fs = require('fs');
const parser = require('@babel/parser');
const generate = require('@babel/generator').default;

const code = fs.readFileSync('src/js/main.js', 'utf8');
const ast = parser.parse(code, { sourceType: 'script' });

ast.program.body.forEach(node => {
  if (node.type === 'FunctionDeclaration') {
    console.log('Function:', node.id.name);
  } else if (node.type === 'VariableDeclaration') {
    node.declarations.forEach(decl => {
      console.log('Variable:', decl.id.name);
    });
  } else {
    console.log('Statement:', node.type);
  }
});
