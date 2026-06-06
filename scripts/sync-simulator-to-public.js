const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'MegaMinx', 'build');
const dest = path.join(__dirname, '..', 'public', 'MegaMinx');

if (!fs.existsSync(path.join(src, 'index.html'))) {
  console.error('MegaMinx build missing. Run: npm run build --prefix MegaMinx');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Synced MegaMinx build -> public/MegaMinx');
