const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist', 'preload');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2)
);
console.log('[postbuild] wrote dist/preload/package.json (type: commonjs)');
