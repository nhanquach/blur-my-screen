importScripts('../shared/messages.js');

const MESSAGES = self.BlurMyScreenMessages;

async function sendToTabs(query, type) {
  const tabs = await chrome.tabs.query(query);
  await Promise.all(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type }).catch(() => undefined)));
}

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') sendToTabs({ active: true }, MESSAGES.AUTO_LOCK);
  if (state === 'active') sendToTabs({ active: true, currentWindow: true }, MESSAGES.RESET);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) sendToTabs({ active: true }, MESSAGES.FOCUS_LOSS);
  else sendToTabs({ active: true, windowId }, MESSAGES.RESET);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.idle.setDetectionInterval(15);
});
