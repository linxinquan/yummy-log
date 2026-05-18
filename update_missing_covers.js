const fs = require('fs');
const path = require('path');

const coversDir = path.join(__dirname, 'images', 'covers');
const covers = fs.readdirSync(coversDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));

function getRandomCover() {
  const idx = Math.floor(Math.random() * covers.length);
  return '/images/covers/' + covers[idx];
}

function ensureLogoField(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find all objects in the arrays and ensure they have a logo/image field.
  // For shopData/foodData, we'll look for `phone: '...',` and if `logo:` doesn't follow, we add it.
  // Actually, an easier way is to parse the JS, but it's not strictly JSON.
  // Let's use a regex that matches the end of an object or after `lat:`
  
  // Let's just find lines with `lat: ...` or `"lat": ...`
  // and append `logo: '...',` or `"image": "...",` on the next line IF it doesn't exist.
  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('lat:') || lines[i].includes('"lat":')) {
      // Check the next few lines for logo/image/thumb until the end of the object '}'
      let hasImage = false;
      let j = i;
      while (j < lines.length && !lines[j].includes('}')) {
        if (lines[j].includes('logo:') || lines[j].includes('"logo":') || 
            lines[j].includes('image:') || lines[j].includes('"image":') || 
            lines[j].includes('thumb:') || lines[j].includes('"thumb":')) {
          hasImage = true;
          break;
        }
        j++;
      }
      
      if (!hasImage) {
        // determine quote style and key name based on lat
        const isJsonStyle = lines[i].includes('"lat":');
        const indent = lines[i].match(/^\s*/)[0];
        
        if (isJsonStyle) {
          lines.splice(i + 1, 0, `${indent}"image": "${getRandomCover()}",`);
        } else {
          lines.splice(i + 1, 0, `${indent}logo: '${getRandomCover()}',`);
        }
      }
    }
  }
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log('Ensured covers in ' + filePath);
}

ensureLogoField(path.join(__dirname, 'utils', 'spotData.js'));
ensureLogoField(path.join(__dirname, 'utils', 'shopData.js'));
ensureLogoField(path.join(__dirname, 'utils', 'foodData.js'));
