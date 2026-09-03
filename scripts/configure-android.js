const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const manifestPath = path.join(raiz, 'android/app/src/main/AndroidManifest.xml');
const resPath = path.join(raiz, 'android/app/src/main/res');

if (!fs.existsSync(manifestPath)) {
  throw new Error('Projeto Android não encontrado. Execute `npx cap add android` antes deste script.');
}

let manifest = fs.readFileSync(manifestPath, 'utf8');
const permissoes = [
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.VIBRATE',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION'
];

for (const permissao of permissoes) {
  if (!manifest.includes(permissao)) {
    manifest = manifest.replace(
      /<manifest([^>]*)>/,
      `<manifest$1>\n    <uses-permission android:name="${permissao}" />`
    );
  }
}

manifest = manifest
  .replace(/android:allowBackup="[^"]*"/g, 'android:allowBackup="false"')
  .replace(/android:usesCleartextTraffic="[^"]*"/g, 'android:usesCleartextTraffic="false"');

if (!manifest.includes('android:allowBackup=')) {
  manifest = manifest.replace(/<application\s+/, '<application\n        android:allowBackup="false"\n        android:usesCleartextTraffic="false"\n        ');
} else if (!manifest.includes('android:usesCleartextTraffic=')) {
  manifest = manifest.replace(/<application\s+/, '<application\n        android:usesCleartextTraffic="false"\n        ');
}

fs.writeFileSync(manifestPath, manifest);

const valuesDir = path.join(resPath, 'values');
const drawableDir = path.join(resPath, 'drawable');
fs.mkdirSync(valuesDir, { recursive: true });
fs.mkdirSync(drawableDir, { recursive: true });

fs.writeFileSync(path.join(drawableDir, 'ic_stat_lumina.xml'), `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="256"
    android:viewportHeight="256">
    <path android:fillColor="#FFFFFFFF" android:pathData="M72,148 L128,52 L184,148 L160,138 L128,188 L96,138 Z" />
    <path android:fillColor="#FF6C63FF" android:pathData="M128,92 A18,18 0,1 0,128,128 A18,18 0,1 0,128,92" />
</vector>`);

// Reuse the same custom mark as the Android launcher icon at every density.
const iconSource = path.join(raiz, 'src/renderer/assets/icon.png');
const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(launcherSizes)) {
  const dir = path.join(resPath, `mipmap-${density}`);
  fs.mkdirSync(dir, { recursive: true });
  const source = path.join(raiz, `src/renderer/assets/icon-${size}.png`);
  fs.copyFileSync(source, path.join(dir, 'ic_launcher.png'));
  fs.copyFileSync(source, path.join(dir, 'ic_launcher_round.png'));
}

const colorsPath = path.join(valuesDir, 'colors.xml');
let colors = fs.existsSync(colorsPath) ? fs.readFileSync(colorsPath, 'utf8') : '<resources>\n</resources>\n';
if (!colors.includes('lumina_background')) {
  colors = colors.replace('</resources>', '    <color name="lumina_background">#0F0F13</color>\n    <color name="lumina_accent">#6C63FF</color>\n</resources>');
  fs.writeFileSync(colorsPath, colors);
}

console.log('Android configurado: permissões sob demanda, cleartext bloqueado e ícone de notificação Lumina.');
