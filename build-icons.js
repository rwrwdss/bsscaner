const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Проверяем, существует ли директория icons
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  console.log('Creating icons directory...');
  execSync('npx electron-icon-maker --input=img/bslogo.png --output=.', { stdio: 'inherit' });
  console.log('✅ Icons created successfully!');
} else {
  console.log('Icons already exist');
}

