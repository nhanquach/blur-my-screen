(() => {
  'use strict';

  const root = typeof window === 'undefined' ? self : window;
  root.BlurMyScreenMessages = Object.freeze({
    LOCK: 'blur-my-screen:lock',
    AUTO_LOCK: 'blur-my-screen:auto-lock',
    RESET: 'blur-my-screen:reset',
    STATUS: 'blur-my-screen:status',
    FOCUS_LOSS: 'blur-my-screen:focus-loss',
    LOCK_STATE: 'blur-my-screen:lock-state',
    GET_LOCK_STATE: 'blur-my-screen:get-lock-state',
  });
})();
