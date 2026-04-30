const fs = require('fs');
const path = require('path');

const coversDir = path.join(__dirname, 'images', 'covers');
const covers = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));

function getRandomCover() {
  const idx = Math.floor(Math.random() * covers.length);
  return '/images/covers/' + covers[idx];
}

function replaceCovers(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/"(image|logo|thumb)"\s*:\s*".*?"/g, (match, p1) => {
    return `"${p1}": "${getRandomCover()}"`;
  });
  
  content = content.replace(/(image|logo|thumb)\s*:\s*'.*?'/g, (match, p1) => {
    return `${p1}: '${getRandomCover()}'`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + filePath);
}

replaceCovers(path.join(__dirname, 'utils', 'spotData.js'));
replaceCovers(path.join(__dirname, 'utils', 'shopData.js'));
replaceCovers(path.join(__dirname, 'utils', 'foodData.js'));