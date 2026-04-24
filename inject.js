const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');

const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(f => {
  const filePath = path.join(publicDir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('navbar-badge.js')) {
    content = content.replace('</body>', '  <!-- Badge navbar -->\n  <script src="/js/navbar-badge.js"></script>\n</body>');
    fs.writeFileSync(filePath, content);
    console.log('Inyectado script en: ' + f);
  }
});
