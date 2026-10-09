const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadTimer() {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src/shared/inactivity-timer.js'), 'utf8'),
    context,
  );
  return context.window.BlurMyScreenInactivityTimer;
}

test('media pause preserves the remaining inactivity budget', () => {
  let time = 1_000;
  const timer = loadTimer().create(() => time);

  timer.reset(30_000);
  time += 12_000;
  assert.equal(timer.pause(), 18_000);
  assert.equal(timer.isPaused(), true);

  time += 60_000;
  assert.equal(timer.remaining(), 18_000);
  timer.resume();
  assert.equal(timer.remaining(), 18_000);

  time += 18_000;
  assert.equal(timer.remaining(), 0);
});

test('a reset clears a paused timer and starts a new configured budget', () => {
  let time = 0;
  const timer = loadTimer().create(() => time);

  timer.reset(10_000);
  time = 4_000;
  timer.pause();
  timer.reset(45_000);

  assert.equal(timer.isPaused(), false);
  assert.equal(timer.remaining(), 45_000);
  timer.clear();
  assert.equal(timer.remaining(), 0);
});
