(() => {
  'use strict';

  const IDLE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'touchmove'];
  const OVERLAY_ID = '__blur_my_page_overlay__';
  const CSS = `
    :host { all: initial; }
    .screen { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; box-sizing: border-box; padding: 24px; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: rgba(9, 15, 27, .30); backdrop-filter: blur(28px) saturate(.78) brightness(.58); -webkit-backdrop-filter: blur(28px) saturate(.78) brightness(.58); opacity: 1; transition: opacity 240ms ease; }
    .screen::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 12% 16%, rgba(92, 173, 255, .22), transparent 30%), radial-gradient(circle at 88% 88%, rgba(170, 105, 255, .18), transparent 34%); }
    .card { position: relative; width: min(100%, 376px); padding: 32px; box-sizing: border-box; text-align: center; border: 1px solid rgba(255,255,255,.22); border-radius: 24px; background: rgba(15, 23, 42, .55); box-shadow: 0 24px 80px rgba(0,0,0,.34); }
    .mark { display: grid; place-items: center; width: 48px; height: 48px; margin: 0 auto 18px; border-radius: 16px; background: linear-gradient(145deg, #9dceff, #8473e8); color: #0b1020; font-size: 24px; box-shadow: 0 8px 28px rgba(105, 142, 255, .32); }
    h1 { margin: 0; font-size: 23px; font-weight: 650; letter-spacing: -.025em; }
    p { margin: 10px 0 24px; color: rgba(241, 245, 249, .78); font-size: 14px; line-height: 1.5; }
    button, input { font: inherit; }
    button { width: 100%; min-height: 48px; border: 0; border-radius: 14px; padding: 0 18px; cursor: pointer; background: #f8fafc; color: #111827; font-weight: 700; transition: transform 150ms ease, background 150ms ease; }
    button:hover { background: white; transform: translateY(-1px); }
    button:focus-visible, input:focus-visible { outline: 3px solid #a5d4ff; outline-offset: 3px; }
    form { display: grid; gap: 12px; }
    input { box-sizing: border-box; width: 100%; min-height: 48px; padding: 0 14px; border: 1px solid rgba(255,255,255,.28); border-radius: 14px; color: white; background: rgba(255,255,255,.10); }
    input::placeholder { color: rgba(241,245,249,.62); }
    .error { min-height: 20px; margin: 0 0 12px; color: #fecaca; font-size: 13px; }
    @media (prefers-reduced-motion: reduce) { .screen, button { transition: none; } }
  `;

  let settings = { enabled: true, unlockMode: 'click', idleMinutes: 3, passwordHash: '' };
  let inactivityTimer;
  let locked = false;
  let host;

  function clearTimer() {
    window.clearTimeout(inactivityTimer);
  }

  function scheduleLock() {
    clearTimer();
    if (!settings.enabled || locked) return;
    inactivityTimer = window.setTimeout(() => lock('idle'), settings.idleMinutes * 60_000);
  }

  function recordActivity() {
    if (!locked) scheduleLock();
  }

  function removeOverlay() {
    host?.remove();
    host = undefined;
  }

  function unlock() {
    locked = false;
    removeOverlay();
    scheduleLock();
  }

  function renderOverlay() {
    removeOverlay();
    host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.setAttribute('aria-live', 'polite');
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${CSS}</style><section class="screen" role="dialog" aria-modal="true" aria-labelledby="blur-title"><div class="card"><div class="mark" aria-hidden="true">◐</div><h1 id="blur-title">Page is resting</h1><p>${settings.unlockMode === 'password' ? 'Enter your password to continue.' : 'Click below when you are ready to continue.'}</p>${settings.unlockMode === 'password' ? '<form><input type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required><p class="error" role="alert"></p><button type="submit">Reveal page</button></form>' : '<button type="button">Reveal page</button>'}</div></section>`;

    const screen = shadow.querySelector('.screen');
    const button = shadow.querySelector('button');
    const input = shadow.querySelector('input');
    if (input) {
      shadow.querySelector('form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const enteredHash = await window.BlurMyPageSettings.hashPassword(input.value);
        if (settings.passwordHash && enteredHash === settings.passwordHash) {
          unlock();
          return;
        }
        shadow.querySelector('.error').textContent = 'That password does not match.';
        input.select();
      });
      queueMicrotask(() => input.focus());
    } else {
      button.addEventListener('click', unlock);
      screen.addEventListener('click', (event) => {
        if (event.target === screen) unlock();
      });
      queueMicrotask(() => button.focus());
    }
    document.documentElement.append(host);
  }

  function lock() {
    if (!settings.enabled || locked) return;
    locked = true;
    clearTimer();
    renderOverlay();
  }

  async function initialize() {
    settings = await window.BlurMyPageSettings.get();
    scheduleLock();
  }

  IDLE_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleLock();
  });

  function applySettings(nextSettings) {
    settings = nextSettings;
    if (!settings.enabled) {
      unlock();
    } else if (locked) {
      renderOverlay();
    } else {
      scheduleLock();
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.blurMyPageSettings) {
      window.BlurMyPageSettings.get().then(applySettings);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'blur-my-page:lock') {
      lock('manual');
      sendResponse({ locked: true });
    } else if (message?.type === 'blur-my-page:status') {
      sendResponse({ locked, enabled: settings.enabled });
    }
  });

  window.BlurMyPage = { lock, unlock, applySettings };
  initialize();
})();
