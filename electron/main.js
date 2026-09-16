const { app, BrowserWindow, ipcMain, safeStorage, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let quickReplyWindow = null;
let quickReplyTimeout = null;

function getTokenStoragePath() {
  return path.join(app.getPath('userData'), 'secure_refresh_token.dat');
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

  // Open external web links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  const fallbackPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html');
  const targetPath = fs.existsSync(indexPath) ? indexPath : fallbackPath;

  mainWindow.loadFile(targetPath).catch(err => {
    console.error('[Electron Main] Failed to load index.html:', err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register safeStorage IPC handlers before ready
ipcMain.handle('auth:get-refresh-token', async () => {
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

ipcMain.handle('auth:set-refresh-token', async (_event, token) => {
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

ipcMain.handle('auth:clear-refresh-token', async () => {
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

ipcMain.handle('window:resize', async (_event, width, height) => {
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

  const notifHtmlPath = path.join(__dirname, 'quick-reply.html');
  quickReplyWindow.loadFile(notifHtmlPath).catch(err => {
    console.error('[Electron Main] Failed to load quick-reply.html:', err);
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
ipcMain.handle('notification:show-quick-reply', (_event, data) => {
  try {
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
    console.error('[Electron Main] Error showing desktop quick reply:', err);
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
