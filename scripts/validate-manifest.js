const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const key of ['manifest_version', 'name', 'version', 'action', 'background', 'content_scripts']) {
  if (!(key in manifest)) throw new Error(`manifest.json is missing ${key}`);
}
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 is required.');

const requiredFiles = [
  'src/background/service-worker.js',
  'src/content/content.js',
  'src/content/pii-scanner.js',
  'src/shared/settings.js',
  'src/popup/popup.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Required file missing: ${file}`);
}

console.log('Manifest and project structure are valid.');
