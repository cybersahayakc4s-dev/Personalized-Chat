const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ELECTRON_PATH = 'C:\\Users\\Pc\\Documents\\Personalize-Chat [FOR PRODUCITON]\\node_modules\\electron\\dist\\electron.exe';
const APP_PATH = path.join(__dirname, '..');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 0;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch (e) {}
    });
  }

  async send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    return res.result?.value;
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function runRegressionSuite() {
  console.log('===========================================================');
  console.log('STARTING DETERMINISTIC SECURITY REGRESSION SUITE');
  console.log('===========================================================\n');

  let passedAll = true;

  // -------------------------------------------------------------
  // PART 1: MOCK UNIT TEST FOR safeStorage.isEncryptionAvailable() === false
  // -------------------------------------------------------------
  console.log('--- PART 1: safeStorage.isEncryptionAvailable() === false Mock Test ---');
  const mockScriptPath = path.join(__dirname, 'temp_mock_safestorage.js');
  fs.writeFileSync(mockScriptPath, `
    const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
    const path = require('path');
    const fs = require('fs');

    // Force safeStorage unavailable
    Object.defineProperty(safeStorage, 'isEncryptionAvailable', {
      value: () => false,
      configurable: true
    });

    require(${JSON.stringify(path.join(APP_PATH, 'electron', 'main.js'))});

    app.whenReady().then(async () => {
      const tokenPath = path.join(app.getPath('userData'), 'secure_refresh_token.dat');

      const win = BrowserWindow.getAllWindows()[0];
      await new Promise(r => {
        if (!win.webContents.isLoading()) return r();
        win.webContents.once('did-finish-load', r);
      });

      const mockEvent = {
        sender: win.webContents,
        senderFrame: {
          parent: null,
          url: win.webContents.getURL()
        }
      };

      const getHandler = ipcMain._invokeHandlers.get('auth:get-refresh-token');
      const setHandler = ipcMain._invokeHandlers.get('auth:set-refresh-token');

      // 1. get-refresh-token purges unencrypted file and returns null
      fs.writeFileSync(tokenPath, 'unencrypted-legacy-token');
      const getResult = await getHandler(mockEvent);
      const existsAfterGet = fs.existsSync(tokenPath);

      // 2. set-refresh-token refuses persistence and deletes any file
      fs.writeFileSync(tokenPath, 'another-legacy-token');
      const setResult = await setHandler(mockEvent, 'secret-refresh-token-data');
      const existsAfterSet = fs.existsSync(tokenPath);

      const success = (getResult === null) && (!existsAfterGet) && (setResult === false) && (!existsAfterSet);
      console.log('SAFESTORAGE_MOCK_RESULT:' + JSON.stringify({
        getResult,
        existsAfterGet,
        setResult,
        existsAfterSet,
        success
      }));

      setTimeout(() => app.quit(), 300);
    });
  `);

  let mockOutput = '';
  const mockProc = spawn(ELECTRON_PATH, [mockScriptPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  mockProc.stdout.on('data', d => { mockOutput += d.toString(); });
  mockProc.stderr.on('data', d => { mockOutput += d.toString(); });

  await new Promise(r => mockProc.on('close', r));
  try { fs.unlinkSync(mockScriptPath); } catch {}

  const match = mockOutput.match(/SAFESTORAGE_MOCK_RESULT:(.*)/);
  if (!match) {
    console.error('Failed to parse safeStorage mock result. Output:', mockOutput);
    passedAll = false;
  } else {
    const mockRes = JSON.parse(match[1]);
    console.log('[Mock Test] getRefreshToken returned null:', mockRes.getResult === null);
    console.log('[Mock Test] Legacy file purged on get:', !mockRes.existsAfterGet);
    console.log('[Mock Test] setRefreshToken returned false:', mockRes.setResult === false);
    console.log('[Mock Test] Token file not written on set:', !mockRes.existsAfterSet);
    console.log('[Mock Test] Overall safeStorage-unavailable verification:', mockRes.success ? 'PASS' : 'FAIL');
    if (!mockRes.success) passedAll = false;
  }

  // -------------------------------------------------------------
  // PART 2: LIVE ELECTRON APP RUNTIME SECURITY TESTS
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Live Electron Runtime Security & CSP Tests ---');
  const liveProc = spawn(ELECTRON_PATH, [APP_PATH, '--remote-debugging-port=9222'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let liveLogs = '';
  liveProc.stdout.on('data', d => { liveLogs += d.toString(); });
  liveProc.stderr.on('data', d => { liveLogs += d.toString(); });

  try {
    let pageTarget = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch('http://127.0.0.1:9222/json');
        const list = await res.json();
        pageTarget = list.find(t => t.type === 'page' && t.url.includes('index.html'));
        if (pageTarget) break;
      } catch {}
    }

    if (!pageTarget) {
      throw new Error('Timeout waiting for Electron CDP target');
    }

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');

    // Test 2.1: Normal application JavaScript booted
    console.log('\n[Test 2.1] Verifying normal React application boot...');
    // Wait for React to mount into #root
    for (let i = 0; i < 15; i++) {
      const len = await cdp.eval('document.getElementById("root")?.innerHTML?.length || 0');
      if (len > 100) break;
      await sleep(300);
    }
    const hasRoot = await cdp.eval('document.getElementById("root") !== null');
    const rootLength = await cdp.eval('document.getElementById("root")?.innerHTML?.length || 0');
    const hasElectronApi = await cdp.eval('typeof window.electronAPI !== "undefined"');
    console.log('[Test 2.1] #root element exists:', hasRoot);
    console.log('[Test 2.1] #root rendered content length:', rootLength);
    console.log('[Test 2.1] window.electronAPI exposed:', hasElectronApi);
    const bootPass = hasRoot && rootLength > 500 && hasElectronApi;
    console.log('[Test 2.1] Normal React boot result:', bootPass ? 'PASS' : 'FAIL');
    if (!bootPass) passedAll = false;

    // Test 2.2: javascript: URL execution is BLOCKED by CSP
    console.log('\n[Test 2.2] Testing javascript: URL execution under strict CSP...');
    await cdp.eval(`(() => {
      try {
        window.location.href = "javascript:document.body.innerHTML='ATTACKED'";
      } catch (e) {}
    })()`);
    await sleep(1000);

    const bodyAttacked = await cdp.eval('document.body.innerHTML.includes("ATTACKED")');
    const rootStillPresent = await cdp.eval('document.getElementById("root") !== null');
    console.log('[Test 2.2] Body contains "ATTACKED":', bodyAttacked);
    console.log('[Test 2.2] Application root still intact:', rootStillPresent);
    const cspPass = (!bodyAttacked) && rootStillPresent;
    console.log('[Test 2.2] javascript: URL execution blocked by CSP:', cspPass ? 'PASS' : 'FAIL');
    if (!cspPass) passedAll = false;

    // Test 2.3: External navigation blocked & delegated
    console.log('\n[Test 2.3] Testing external navigation delegation...');
    const initialUrl = await cdp.eval('window.location.href');
    await cdp.eval('window.location.href = "https://example.com"');
    await sleep(1000);
    const postNavUrl = await cdp.eval('window.location.href');
    const extNavPass = (postNavUrl === initialUrl);
    console.log('[Test 2.3] Window remained on application URL:', extNavPass);
    console.log('[Test 2.3] External navigation blocked inside Electron:', extNavPass ? 'PASS' : 'FAIL');
    if (!extNavPass) passedAll = false;

    cdp.close();
  } finally {
    try { liveProc.kill(); } catch {}
  }

  console.log('\n===========================================================');
  console.log('FINAL REGRESSION SUITE STATUS:', passedAll ? 'ALL PASSED' : 'FAILURES DETECTED');
  console.log('===========================================================');

  process.exit(passedAll ? 0 : 1);
}

runRegressionSuite().catch(err => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
