const { app, BrowserWindow, ipcMain, safeStorage, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');

let mainWindow = null;
let quickReplyWindow = null;
let quickReplyTimeout = null;

function getTokenStoragePath() {
  return path.join(app.getPath('userData'), 'secure_refresh_token.dat');
}

/**
 * Security Helper: Verifies that a target file: URL resolves strictly to the
 * expected application HTML file within the client distribution directory.
 */
function isAllowedAppFileUrl(targetUrl, expectedFilename = 'index.html') {
  try {
    if (!targetUrl || typeof targetUrl !== 'string') return false;
    if (!targetUrl.startsWith('file:')) return false;

    const parsedPath = path.normalize(fileURLToPath(targetUrl));
    const distPath1 = path.normalize(path.join(__dirname, '..', 'client', 'dist', expectedFilename));
    const distPath2 = path.normalize(path.join(app.getAppPath(), 'client', 'dist', expectedFilename));

    return parsedPath.toLowerCase() === distPath1.toLowerCase() ||
           parsedPath.toLowerCase() === distPath2.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Security Helper (E-2): Validates that an IPC call originates exclusively from the
 * top-level main frame of the trusted application mainWindow.
 * Fails closed on any unexpected sender, frame, or navigation target.
 */
function isTrustedRendererSender(event) {
  if (!event || !event.sender) {
    return false;
  }

  // Must originate from the mainWindow WebContents
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    return false;
  }

  // Verify senderFrame if available (modern Electron WebFrameMain)
  if (event.senderFrame) {
    // Top-level frame only: block subframes/iframes from invoking privileged IPC
    if (event.senderFrame.parent !== null) {
      return false;
    }
    const frameUrl = event.senderFrame.url;
    if (!isAllowedAppFileUrl(frameUrl, 'index.html')) {
      return false;
    }
  } else {
    // Fallback: verify main webContents URL
    const senderUrl = event.sender.getURL();
    if (!isAllowedAppFileUrl(senderUrl, 'index.html')) {
      return false;
    }
  }

  return true;
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'client', 'dist', 'icon-512.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 320,
    minHeight: 500,
    title: 'Personalize Chat',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Navigation Policy (E-1): Open external links in default system browser, deny inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Navigation Policy (E-1): Prevent in-window navigation away from application content
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // External web URLs are delegated to the default OS browser
    if (navigationUrl.startsWith('http:') || navigationUrl.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
      return;
    }

    // Allow legitimate reloads or navigations to the local application index.html
    if (isAllowedAppFileUrl(navigationUrl, 'index.html')) {
      return;
    }

    // Deny all arbitrary protocols (javascript:, data:, file:// to unexpected paths, etc.)
    event.preventDefault();
  });

  // Navigation Policy (E-1): Prevent iframe navigations to untrusted origins
  mainWindow.webContents.on('will-frame-navigate', (event) => {
    if (!isAllowedAppFileUrl(event.url, 'index.html')) {
      event.preventDefault();
    }
  });

  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  const fallbackPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html');
  const targetPath = fs.existsSync(indexPath) ? indexPath : fallbackPath;

  mainWindow.loadFile(targetPath).catch(err => {
    console.error('[Electron Main] Failed to load index.html:', err.message);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register safeStorage IPC handlers before ready
ipcMain.handle('auth:get-refresh-token', async (event) => {
  // Caller verification (E-2)
  if (!isTrustedRendererSender(event)) {
    console.warn('[Electron Main Security] Rejected unauthorized IPC invocation for auth:get-refresh-token');
    return null;
  }

  try {
    const tokenPath = getTokenStoragePath();
    if (!fs.existsSync(tokenPath)) {
      return null;
    }

    // Storage Policy (E-3): Refuse unencrypted plaintext fallback
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[Electron Main Security] safeStorage encryption unavailable. Purging unencrypted token file.');
      try { fs.unlinkSync(tokenPath); } catch {}
      return null;
    }

    const buffer = fs.readFileSync(tokenPath);
    return safeStorage.decryptString(buffer);
  } catch (err) {
    console.error('[Electron Main] Failed to read/decrypt refresh token:', err.message);
    // If decryption fails (e.g. invalid format or corrupted ciphertext), safely remove file
    try {
      const tokenPath = getTokenStoragePath();
      if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    } catch {}
    return null;
  }
});

ipcMain.handle('auth:set-refresh-token', async (event, token) => {
  // Caller verification (E-2)
  if (!isTrustedRendererSender(event)) {
    console.warn('[Electron Main Security] Rejected unauthorized IPC invocation for auth:set-refresh-token');
    return false;
  }

  try {
    const tokenPath = getTokenStoragePath();
    if (!token || typeof token !== 'string') {
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
      }
      return true;
    }

    // Storage Policy (E-3): Strictly refuse plaintext storage when OS encryption is unavailable
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[Electron Main Security] safeStorage encryption is unavailable. Refusing plaintext fallback for refresh token.');
      if (fs.existsSync(tokenPath)) {
        try { fs.unlinkSync(tokenPath); } catch {}
      }
      return false;
    }

    const encrypted = safeStorage.encryptString(token);
    fs.writeFileSync(tokenPath, encrypted);
    return true;
  } catch (err) {
    console.error('[Electron Main] Failed to encrypt/save refresh token:', err.message);
    return false;
  }
});

ipcMain.handle('auth:clear-refresh-token', async (event) => {
  // Caller verification (E-2)
  if (!isTrustedRendererSender(event)) {
    console.warn('[Electron Main Security] Rejected unauthorized IPC invocation for auth:clear-refresh-token');
    return false;
  }

  try {
    const tokenPath = getTokenStoragePath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    return true;
  } catch (err) {
    console.error('[Electron Main] Failed to clear refresh token:', err.message);
    return false;
  }
});

ipcMain.handle('window:resize', async (event, width, height) => {
  if (!isTrustedRendererSender(event)) {
    return false;
  }
  if (mainWindow && typeof width === 'number' && typeof height === 'number') {
    mainWindow.setSize(Math.max(320, width), Math.max(500, height));
    return true;
  }
  return false;
});

function createQuickReplyWindow() {
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    return quickReplyWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.workArea;

  const winWidth = 400;
  const winHeight = 220;
  // Position at bottom-left: 24px from left margin, 20px above taskbar
  const winX = x + 24;
  const winY = y + height - winHeight - 20;

  quickReplyWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: winX,
    y: winY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Navigation Policy (E-1): quickReplyWindow must never open windows or navigate away
  quickReplyWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  quickReplyWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    event.preventDefault();
    if (navigationUrl.startsWith('http:') || navigationUrl.startsWith('https:')) {
      shell.openExternal(navigationUrl);
    }
  });

  const notifHtmlPath = path.join(__dirname, 'quick-reply.html');
  quickReplyWindow.loadFile(notifHtmlPath).catch(err => {
    console.error('[Electron Main] Failed to load quick-reply.html:', err.message);
  });

  quickReplyWindow.on('closed', () => {
    quickReplyWindow = null;
  });

  return quickReplyWindow;
}

// App minimization check
ipcMain.handle('app:is-minimized', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  return mainWindow.isMinimized() || !mainWindow.isFocused();
});

// Show desktop quick-reply notification at bottom-left when app is minimized
ipcMain.handle('notification:show-quick-reply', (event, data) => {
  try {
    if (!isTrustedRendererSender(event)) return false;
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    const isMin = mainWindow.isMinimized() || !mainWindow.isFocused();
    if (!isMin) return false;

    const win = createQuickReplyWindow();

    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.workArea;
    const winWidth = 400;
    const winHeight = 220;
    win.setBounds({
      x: x + 24,
      y: y + height - winHeight - 20,
      width: winWidth,
      height: winHeight
    });

    win.webContents.send('quick-reply:load', data);
    win.showInactive();
    win.setAlwaysOnTop(true, 'screen-saver');

    if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
    quickReplyTimeout = setTimeout(() => {
      if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
        quickReplyWindow.hide();
      }
    }, 25000);

    return true;
  } catch (err) {
    console.error('[Electron Main] Error showing desktop quick reply:', err.message);
    return false;
  }
});

// User clicked chip or submitted quick reply
ipcMain.handle('quick-reply:send-action', (_event, { conversationId, content }) => {
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('quick-reply:delivered', { conversationId, content });
    return true;
  }
  return false;
});

// User clicked notification to open app
ipcMain.handle('quick-reply:open-app', (_event, { conversationId }) => {
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (conversationId) {
      mainWindow.webContents.send('conversation:switch', { conversationId });
    }
    return true;
  }
  return false;
});

// User closed notification
ipcMain.handle('quick-reply:close', () => {
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  return true;
});

app.whenReady().then(() => {
  // Content Security Policy (E-1 Defense-in-Depth):
  // Enforce strict CSP preventing inline/eval/javascript: execution in the main renderer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.includes('quick-reply.html')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com data:; " +
            "img-src 'self' data: blob: http: https:; " +
            "media-src 'self' data: blob:; " +
            "connect-src 'self' http: https: ws: wss:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "frame-src 'none';"
          ]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
