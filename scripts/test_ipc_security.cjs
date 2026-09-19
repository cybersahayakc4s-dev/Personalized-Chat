/**
 * Automated Security Test Suite: SEC-IPC-01 Verification
 * Tests that updater:check, updater:install, and updater:get-state
 * strictly reject untrusted renderers, rogue child frames, and external URLs,
 * and only accept legitimate mainWindow top-level requests.
 */

const assert = require('assert');
const path = require('path');
const { fileURLToPath } = require('url');

// 1. Replicate isAllowedAppFileUrl and isTrustedRendererSender directly from merged main.js
function isAllowedAppFileUrl(targetUrl, expectedFilename = 'index.html', fakeAppPath = 'C:\\app') {
  try {
    if (!targetUrl || typeof targetUrl !== 'string') return false;
    if (!targetUrl.startsWith('file:')) return false;

    const parsedPath = path.normalize(fileURLToPath(targetUrl));
    const distPath1 = path.normalize(path.join(fakeAppPath, 'client', 'dist', expectedFilename));
    const distPath2 = path.normalize(path.join(fakeAppPath, 'client', 'dist', expectedFilename));

    return parsedPath.toLowerCase() === distPath1.toLowerCase() ||
           parsedPath.toLowerCase() === distPath2.toLowerCase();
  } catch {
    return false;
  }
}

function isTrustedRendererSender(event, mainWindow, fakeAppPath) {
  if (!event || !event.sender) {
    return false;
  }

  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return false;
  }

  if (event.senderFrame) {
    if (event.senderFrame.parent !== null) {
      return false; // nested iframes blocked
    }
    const frameUrl = event.senderFrame.url;
    if (!isAllowedAppFileUrl(frameUrl, 'index.html', fakeAppPath)) {
      return false; // foreign/unauthorized file URL blocked
    }
  }

  return true;
}

// 2. Define the 3 IPC handlers exactly as written in the merged main.js
function createHandlers(mainWindow, fakeAppPath, mockUpdaterState, mockAutoUpdater) {
  return {
    'updater:check': async (event) => {
      if (!isTrustedRendererSender(event, mainWindow, fakeAppPath)) {
        return { ok: false, error: 'Unauthorized IPC caller' };
      }
      return { ok: true, updateInfo: { version: '3.1.1' } };
    },

    'updater:install': async (event) => {
      if (!isTrustedRendererSender(event, mainWindow, fakeAppPath)) {
        return false;
      }
      mockAutoUpdater.installed = true;
      return true;
    },

    'updater:get-state': async (event) => {
      if (!isTrustedRendererSender(event, mainWindow, fakeAppPath)) {
        return null;
      }
      return { ...mockUpdaterState, version: '3.1.1' };
    }
  };
}

// 3. Run test scenarios
async function runTests() {
  console.log('====================================================');
  console.log('RUNNING SEC-IPC-01 AUTOMATED IPC SENDER SECURITY TEST');
  console.log('====================================================\n');

  const fakeAppPath = 'C:\\PersonalizeChat';
  const legitimateUrl = 'file:///C:/PersonalizeChat/client/dist/index.html';

  const mockWebContents = { id: 1 };
  const mockMainWindow = {
    webContents: mockWebContents,
    isDestroyed: () => false
  };

  const mockUpdaterState = { status: 'available' };
  const mockAutoUpdater = { installed: false };

  const handlers = createHandlers(mockMainWindow, fakeAppPath, mockUpdaterState, mockAutoUpdater);

  // Scenario 1: Missing or null event (direct injection / exploit)
  console.log('[Test 1] Missing event / null event:');
  assert.strictEqual((await handlers['updater:check'](null)).ok, false);
  assert.strictEqual((await handlers['updater:check'](null)).error, 'Unauthorized IPC caller');
  assert.strictEqual(await handlers['updater:install'](null), false);
  assert.strictEqual(await handlers['updater:get-state'](null), null);
  console.log('  -> PASS: Rejected null event across all 3 handlers.');

  // Scenario 2: Unauthorized WebContents sender (rogue window / second instance)
  console.log('[Test 2] Unauthorized sender (rogue webContents):');
  const rogueEvent = {
    sender: { id: 999 }, // different object reference
    senderFrame: { parent: null, url: legitimateUrl }
  };
  assert.strictEqual((await handlers['updater:check'](rogueEvent)).ok, false);
  assert.strictEqual(await handlers['updater:install'](rogueEvent), false);
  assert.strictEqual(await handlers['updater:get-state'](rogueEvent), null);
  console.log('  -> PASS: Rejected rogue webContents across all 3 handlers.');

  // Scenario 3: Call from a child frame / iframe (embedded web page or ad)
  console.log('[Test 3] Child frame / iframe caller (parent !== null):');
  const childFrameEvent = {
    sender: mockWebContents,
    senderFrame: { parent: { id: 'parent-frame' }, url: legitimateUrl }
  };
  assert.strictEqual((await handlers['updater:check'](childFrameEvent)).ok, false);
  assert.strictEqual(await handlers['updater:install'](childFrameEvent), false);
  assert.strictEqual(await handlers['updater:get-state'](childFrameEvent), null);
  console.log('  -> PASS: Rejected child iframe caller across all 3 handlers.');

  // Scenario 4: Call after window navigated away to external URL (e.g. evil.com)
  console.log('[Test 4] Navigated away to external web URL (https://evil.com):');
  const navigatedEvent = {
    sender: mockWebContents,
    senderFrame: { parent: null, url: 'https://evil.com/phish' }
  };
  assert.strictEqual((await handlers['updater:check'](navigatedEvent)).ok, false);
  assert.strictEqual(await handlers['updater:install'](navigatedEvent), false);
  assert.strictEqual(await handlers['updater:get-state'](navigatedEvent), null);
  console.log('  -> PASS: Rejected navigated external URL across all 3 handlers.');

  // Scenario 5: Legitimate top-level main window caller
  console.log('[Test 5] Legitimate top-level mainWindow caller:');
  const legitimateEvent = {
    sender: mockWebContents,
    senderFrame: { parent: null, url: legitimateUrl }
  };
  const checkRes = await handlers['updater:check'](legitimateEvent);
  assert.strictEqual(checkRes.ok, true);
  assert.strictEqual(checkRes.updateInfo.version, '3.1.1');

  const installRes = await handlers['updater:install'](legitimateEvent);
  assert.strictEqual(installRes, true);
  assert.strictEqual(mockAutoUpdater.installed, true);

  const stateRes = await handlers['updater:get-state'](legitimateEvent);
  assert.strictEqual(stateRes.status, 'available');
  assert.strictEqual(stateRes.version, '3.1.1');
  console.log('  -> PASS: Allowed legitimate top-level mainWindow caller across all 3 handlers.\n');

  console.log('====================================================');
  console.log('ALL 5 SEC-IPC-01 TESTS PASSED DETERMINISTICALLY (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
