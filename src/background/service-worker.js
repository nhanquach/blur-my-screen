('use strict');

// Message types for communication with content scripts
const MESSAGES = {
  LOCK: 'blur-my-screen:lock',
  RESET: 'blur-my-screen:reset',
  STATUS_QUERY: 'blur-my-screen:status',
};

async function notifyActiveTabs(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Send message to the active tab
    await chrome.tabs.sendMessage(tab.id, { type: message });
  } catch (e) {
    // Ignore errors (e.g., no content script loaded on the page)
  }
}

// System Idle Coordination
chrome.idle.onStateChanged.addListener(async (newState) => {
  if (newState === 'idle') {
    console.log('System became idle. Requesting cloak.');
    await notifyActiveTabs(MESSAGES.LOCK);
  } else if (newState === 'active') {
    console.log('System became active. Requesting timer reset.');
    await notifyActiveTabs(MESSAGES.RESET);
  }
});

// Window/Tab Focus Coordination
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  
  // When the window gains focus, it might be a context switch.
  // We notify active tabs so they can decide whether to lock (if cloakOnFocusLoss is true)
  // or reset their internal timers.
  await notifyActiveTabs(MESSAGES.RESET);
});

// Initialize idle detection on startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('BlurMyScreen background worker initialized.');
});
