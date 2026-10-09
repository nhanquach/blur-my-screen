importScripts('../shared/messages.js');

const MESSAGES = self.BlurMyScreenMessages;

async function sendToTabs(query, type) {
  const tabs = await chrome.tabs.query(query);
  await Promise.all(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type }).catch(() => undefined)));
}

let focusedWindowId;
chrome.windows.getLastFocused().then((window) => { focusedWindowId = window?.id; }).catch(() => undefined);
const LOCKED_TABS_KEY = 'blurMyScreenLockedTabs';
let lockStateQueue = Promise.resolve();

function updateLockedTab(tabId, locked) {
  lockStateQueue = lockStateQueue.catch(() => undefined).then(async () => {
    const stored = await chrome.storage.session.get(LOCKED_TABS_KEY);
    const lockedTabs = stored[LOCKED_TABS_KEY] || {};
    if (locked) lockedTabs[tabId] = true;
    else delete lockedTabs[tabId];
    await chrome.storage.session.set({ [LOCKED_TABS_KEY]: lockedTabs });
  });
  return lockStateQueue;
}

async function activeTabInWindow(windowId) {
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  return tab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MESSAGES.LOCK_STATE || !Number.isInteger(sender.tab?.id)) return;
  const tabId = sender.tab.id;
  updateLockedTab(tabId, Boolean(message.locked)).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MESSAGES.GET_LOCK_STATE || !Number.isInteger(sender.tab?.id)) return;
  lockStateQueue.then(() => chrome.storage.session.get(LOCKED_TABS_KEY)).then((stored) => {
    sendResponse({ locked: Boolean(stored[LOCKED_TABS_KEY]?.[sender.tab.id]) });
  }).catch(() => sendResponse({ locked: false }));
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  updateLockedTab(tabId, false).catch(() => undefined);
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') sendToTabs({ active: true, currentWindow: true }, MESSAGES.AUTO_LOCK);
  if (state === 'active') sendToTabs({ active: true, currentWindow: true }, MESSAGES.RESET);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const previous = focusedWindowId;
  focusedWindowId = windowId === chrome.windows.WINDOW_ID_NONE ? undefined : windowId;
  if (previous !== undefined && previous !== focusedWindowId) {
    const previousTab = await activeTabInWindow(previous);
    if (previousTab?.id) chrome.tabs.sendMessage(previousTab.id, { type: MESSAGES.FOCUS_LOSS }).catch(() => undefined);
  }
  if (focusedWindowId !== undefined) {
    const tab = await activeTabInWindow(focusedWindowId);
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: MESSAGES.RESET }).catch(() => undefined);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Chrome's minimum is 15s; content scripts enforce the user's exact timeout.
  chrome.idle.setDetectionInterval(15);
});
