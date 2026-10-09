(() => {
  'use strict';

  function create(now = () => Date.now()) {
    let deadline = 0;
    let pausedRemainingMs = null;

    function reset(timeoutMs) {
      pausedRemainingMs = null;
      deadline = now() + Math.max(0, Number(timeoutMs) || 0);
      return deadline;
    }

    function pause() {
      if (pausedRemainingMs !== null) return pausedRemainingMs;
      pausedRemainingMs = deadline ? Math.max(0, deadline - now()) : 0;
      deadline = 0;
      return pausedRemainingMs;
    }

    function resume() {
      if (pausedRemainingMs === null) return deadline;
      deadline = now() + pausedRemainingMs;
      pausedRemainingMs = null;
      return deadline;
    }

    function remaining() {
      return pausedRemainingMs === null ? Math.max(0, deadline - now()) : pausedRemainingMs;
    }

    function clear() {
      deadline = 0;
      pausedRemainingMs = null;
    }

    return Object.freeze({
      reset,
      pause,
      resume,
      remaining,
      clear,
      isPaused: () => pausedRemainingMs !== null,
      hasDeadline: () => deadline > 0,
    });
  }

  const root = typeof window === 'undefined' ? self : window;
  root.BlurMyScreenInactivityTimer = Object.freeze({ create });
})();
