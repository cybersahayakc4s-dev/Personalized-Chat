const { app, BrowserWindow, ipcMain, safeStorage, screen, session, shell, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');

let mainWindow = null;
let quickReplyWindow = null;
let quickReplyTimeout = null;
let tray = null;
let isQuitting = false;

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let updaterState = {
  status: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version: app.getVersion(),
  info: null,
  progress: null,
  error: null,
};

function broadcastUpdaterStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status-changed', updaterState);
  }
}

autoUpdater.on('checking-for-update', () => {
  updaterState = { ...updaterState, status: 'checking', error: null };
  broadcastUpdaterStatus();
});

autoUpdater.on('update-available', (info) => {
  updaterState = { ...updaterState, status: 'available', info, error: null };
  broadcastUpdaterStatus();
});

autoUpdater.on('update-not-available', (info) => {
  updaterState = { ...updaterState, status: 'not-available', info, error: null };
  broadcastUpdaterStatus();
});

autoUpdater.on('download-progress', (progressObj) => {
  updaterState = { ...updaterState, status: 'downloading', progress: progressObj, error: null };
  broadcastUpdaterStatus();
});

autoUpdater.on('update-downloaded', (info) => {
  updaterState = { ...updaterState, status: 'downloaded', info, error: null };
  broadcastUpdaterStatus();
});

autoUpdater.on('error', (err) => {
  updaterState = { ...updaterState, status: 'error', error: err?.message || 'Update check failed' };
  broadcastUpdaterStatus();
});

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
    // Disallow calls from child/nested iframes
    if (event.senderFrame.parent !== null) {
      return false;
    }
    // Disallow calls if frame navigated away from legitimate client distribution
    const frameUrl = event.senderFrame.url;
    if (!isAllowedAppFileUrl(frameUrl, 'index.html')) {
      return false;
    }
  }

  return true;
}

function getTokenStoragePath() {
  return path.join(app.getPath('userData'), 'secure_refresh_token.dat');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'client', 'dist', 'icon-512.png'),
    path.join(__dirname, '..', 'client', 'public', 'icon-512.png'),
    path.join(app.getAppPath(), 'client', 'dist', 'icon-512.png'),
  ];
  return candidates.find(p => fs.existsSync(p));
}

function createTray() {
  if (tray) return tray;

  const validIconPath = getAppIconPath();
  let trayIcon;
  if (validIconPath) {
    trayIcon = nativeImage.createFromPath(validIconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Personalize Chat');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Personalize Chat',
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Check for Updates...',
      click: () => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        if (app.isPackaged) {
          autoUpdater.checkForUpdates().catch(err => {
            console.error('[AutoUpdater] Manual check error:', err?.message);
          });
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Personalize Chat',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return tray;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Security: Deny all sensitive runtime permission requests
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const deniedPermissions = ['media', 'geolocation', 'notifications', 'midi', 'openExternal'];
    if (deniedPermissions.includes(permission)) {
      return callback(false);
    }
    return callback(false);
  });

  // Open external web links strictly in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Navigation Guard: Prevent main window from navigating away from the local app bundle
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedAppFileUrl(navigationUrl, 'index.html')) {
      event.preventDefault();
      console.warn(`[Security Guard] Blocked unauthorized window navigation to: ${navigationUrl}`);
    }
  });

  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  const fallbackPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html');
  const targetPath = fs.existsSync(indexPath) ? indexPath : fallbackPath;

  mainWindow.loadFile(targetPath).catch(err => {
    console.error('[Electron Main] Failed to load index.html:', err);
  });

  // Intercept close button: minimize to System Tray instead of quitting process
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register safeStorage IPC handlers
ipcMain.handle('auth:get-refresh-token', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for auth:get-refresh-token');
    return null;
  }
  try {
    const tokenPath = getTokenStoragePath();
    if (!fs.existsSync(tokenPath)) {
      return null;
    }
    const buffer = fs.readFileSync(tokenPath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buffer);
    } else {
      return buffer.toString('utf8');
    }
  } catch (err) {
    console.error('[Electron Main] Failed to read/decrypt refresh token:', err);
    return null;
  }
});

ipcMain.handle('auth:set-refresh-token', async (event, token) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for auth:set-refresh-token');
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
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(tokenPath, encrypted);
    } else {
      fs.writeFileSync(tokenPath, Buffer.from(token, 'utf8'));
    }
    return true;
  } catch (err) {
    console.error('[Electron Main] Failed to encrypt/save refresh token:', err);
    return false;
  }
});

ipcMain.handle('auth:clear-refresh-token', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for auth:clear-refresh-token');
    return false;
  }
  try {
    const tokenPath = getTokenStoragePath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    return true;
  } catch (err) {
    console.error('[Electron Main] Failed to clear refresh token:', err);
    return false;
  }
});

ipcMain.handle('window:resize', async (event, width, height) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for window:resize');
    return false;
  }
  if (mainWindow) {
    mainWindow.setSize(width, height);
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

  const notifHtmlPath = path.join(__dirname, 'quick-reply.html');
  quickReplyWindow.loadFile(notifHtmlPath).catch(err => {
    console.error('[Electron Main] Failed to load quick-reply.html:', err);
  });

  quickReplyWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  quickReplyWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  quickReplyWindow.on('closed', () => {
    quickReplyWindow = null;
  });

  return quickReplyWindow;
}

ipcMain.handle('quick-reply:show', async (event, data) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for quick-reply:show');
    return false;
  }
  try {
    const win = createQuickReplyWindow();
    win.webContents.send('quick-reply:load', data);
    win.showInactive();

    if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
    quickReplyTimeout = setTimeout(() => {
      if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
        quickReplyWindow.hide();
      }
    }, 10000);

    return true;
  } catch (err) {
    console.error('[Electron Main] Failed to show quick reply window:', err);
    return false;
  }
});

ipcMain.handle('quick-reply:hide', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for quick-reply:hide');
    return false;
  }
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  return true;
});

ipcMain.handle('quick-reply:send', async (event, replyData) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for quick-reply:send');
    return false;
  }
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('quick-reply:submitted', replyData);
    return true;
  }
  return false;
});

ipcMain.handle('quick-reply:open-chat', async (event, conversationId) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for quick-reply:open-chat');
    return false;
  }
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (conversationId) {
      mainWindow.webContents.send('quick-reply:navigate', conversationId);
    }
    return true;
  }
  return false;
});

ipcMain.handle('quick-reply:close', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for quick-reply:close');
    return false;
  }
  if (quickReplyTimeout) clearTimeout(quickReplyTimeout);
  if (quickReplyWindow && !quickReplyWindow.isDestroyed()) {
    quickReplyWindow.hide();
  }
  return true;
});

// Auto-Updater IPC handlers (Hardened with isTrustedRendererSender)
ipcMain.handle('updater:check', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for updater:check');
    return { ok: false, error: 'Unauthorized IPC caller' };
  }
  if (!app.isPackaged) {
    return { ok: false, message: 'Auto-update is only active in packaged desktop builds' };
  }
  try {
    updaterState = { ...updaterState, status: 'checking', error: null };
    broadcastUpdaterStatus();
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, updateInfo: result?.updateInfo };
  } catch (err) {
    updaterState = { ...updaterState, status: 'error', error: err?.message || 'Failed to check for updates' };
    broadcastUpdaterStatus();
    return { ok: false, error: err?.message };
  }
});

ipcMain.handle('updater:install', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for updater:install');
    return false;
  }
  isQuitting = true;
  autoUpdater.quitAndInstall();
  return true;
});

ipcMain.handle('updater:get-state', async (event) => {
  if (!isTrustedRendererSender(event)) {
    console.warn('[Security Guard] Unauthorized IPC caller rejected for updater:get-state');
    return null;
  }
  return { ...updaterState, version: app.getVersion() };
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('[AutoUpdater] Initial background check notice:', err?.message);
      });
    }, 6000);

    setInterval(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('[AutoUpdater] Periodic check notice:', err?.message);
      });
    }, 2 * 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
