const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { version } = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const dist = 'dist';
const out = path.join(dist, `blur-my-screen-${version}.zip`);
fs.mkdirSync(dist, { recursive: true });
fs.rmSync(out, { force: true });
// Only ship what the extension loads; tests, docs, and planning files stay out of the store package.
execFileSync('zip', ['-r', '-X', out, 'manifest.json', 'src', 'public', '-x', '*.DS_Store'], { stdio: 'inherit' });
console.log(`Created ${out}`);
