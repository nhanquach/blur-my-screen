const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const key of ['manifest_version', 'name', 'version', 'action', 'content_scripts']) {
  if (!(key in manifest)) throw new Error(`manifest.json is missing ${key}`);
}
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 is required.');
console.log('Manifest is valid.');
