#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const set = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
if (!fs.existsSync(set)) throw new Error('Catálogo iOS não encontrado; execute `npx cap add ios` antes deste script.');
const assets = path.join(root, 'src/renderer/assets');
const entries = [
  ['icon-1024.png', 'AppIcon-1024.png', 1024, 1, 'ios-marketing'],
  ['icon-192.png', 'AppIcon-192.png', 96, 2, 'iphone', '2x'],
  ['icon-144.png', 'AppIcon-144.png', 72, 2, 'iphone', '3x'],
  ['icon-96.png', 'AppIcon-96.png', 48, 2, 'ipad', '2x'],
  ['icon-192.png', 'AppIcon-192-ipad.png', 96, 2, 'ipad', '2x'],
];
for (const [source, target] of entries) fs.copyFileSync(path.join(assets, source), path.join(set, target));
const contents = { images: entries.map(([, filename, points, scale, idiom, scaleLabel]) => ({ filename, idiom, scale: scaleLabel || '1x', size: `${points}x${points}` })), info: { author: 'xcode', version: 1 } };
fs.writeFileSync(path.join(set, 'Contents.json'), JSON.stringify(contents, null, 2) + '\n');
console.log('iOS configurado: AppIcon Lumina aplicado ao catálogo Assets.xcassets.');
