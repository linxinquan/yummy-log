const fs = require('fs');
const https = require('https');
const sharp = require('sharp');

const ICONS = [
  { name: 'tabbar-home.png', icon: 'compass-line', color: '9CA3AF' },
  { name: 'tabbar-home-active.png', icon: 'compass-fill', color: '47BFFE' },
  { name: 'tabbar-spots.png', icon: 'heart-line', color: '9CA3AF' },
  { name: 'tabbar-spots-active.png', icon: 'heart-fill', color: '47BFFE' },
  { name: 'tabbar-discover.png', icon: 'notebook-line', color: '9CA3AF' },
  { name: 'tabbar-discover-active.png', icon: 'notebook-fill', color: '47BFFE' },
  { name: 'tabbar-my.png', icon: 'user-3-line', color: '9CA3AF' },
  { name: 'tabbar-my-active.png', icon: 'user-3-fill', color: '47BFFE' },
];

const fetchIconSvg = (iconName, color) => {
  return new Promise((resolve, reject) => {
    let url = `https://api.iconify.design/mingcute:${iconName}.svg?color=%23${color}`;
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status Code: ${res.statusCode}`));
      } else {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    }).on('error', reject);
  });
};

(async () => {
  for (const item of ICONS) {
    try {
      console.log(`Fetching ${item.icon}...`);
      let svgStr = await fetchIconSvg(item.icon, item.color);
      const buffer = Buffer.from(svgStr);
      await sharp(buffer)
        .resize(81, 81)
        .png()
        .toFile(`images/${item.name}`);
      console.log(`Saved ${item.name}`);
    } catch (e) {
      console.error(`Error for ${item.icon}:`, e);
    }
  }
})();
