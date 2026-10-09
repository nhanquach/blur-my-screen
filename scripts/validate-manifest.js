const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
for (const key of ['manifest_version', 'name', 'version', 'action', 'background', 'content_scripts']) {
  if (!(key in manifest)) throw new Error(`manifest.json is missing ${key}`);
}
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 is required.');
if (manifest.background.service_worker !== 'src/background/service-worker.js') throw new Error('Expected the BlurMyScreen service worker.');
for (const permission of ['storage', 'tabs', 'idle', 'windows']) {
  if (!manifest.permissions?.includes(permission)) throw new Error(`Missing required permission: ${permission}`);
}
const scripts = manifest.content_scripts?.[0];
const expectedScripts = ['src/shared/messages.js', 'src/shared/settings.js', 'src/content/pii-scanner.js', 'src/content/content.js'];
if (!scripts || JSON.stringify(scripts.js) !== JSON.stringify(expectedScripts)) throw new Error('Content scripts must load shared modules, PII scanner, then controller.');
if (JSON.stringify(scripts.matches) !== JSON.stringify(['http://*/*', 'https://*/*'])) throw new Error('Content scripts must be limited to HTTP(S) pages.');
for (const file of [...expectedScripts, manifest.background.service_worker, 'src/popup/popup.js']) {
  if (!fs.existsSync(file)) throw new Error(`Required file missing: ${file}`);
}
console.log('Manifest and project structure are valid.');
