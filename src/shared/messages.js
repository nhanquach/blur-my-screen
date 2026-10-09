(() => {
  'use strict';

  const root = typeof window === 'undefined' ? self : window;
  root.BlurMyScreenMessages = Object.freeze({
    LOCK: 'blur-my-screen:lock',
    AUTO_LOCK: 'blur-my-screen:auto-lock',
    RESET: 'blur-my-screen:reset',
    STATUS: 'blur-my-screen:status',
    FOCUS_LOSS: 'blur-my-screen:focus-loss',
  });
})();
