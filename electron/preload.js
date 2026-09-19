const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getRefreshToken: () => ipcRenderer.invoke('auth:get-refresh-token'),
  setRefreshToken: (token) => ipcRenderer.invoke('auth:set-refresh-token', token),
  clearRefreshToken: () => ipcRenderer.invoke('auth:clear-refresh-token'),
  resize: (width, height) => ipcRenderer.invoke('window:resize', width, height),

  // Minimized state and desktop notification methods
  isAppMinimized: () => ipcRenderer.invoke('app:is-minimized'),
  showDesktopQuickReply: (data) => ipcRenderer.invoke('notification:show-quick-reply', data),
  closeDesktopQuickReply: () => ipcRenderer.invoke('quick-reply:close'),

  // Listeners for main window
  onQuickReplySend: (callback) => {
    ipcRenderer.on('quick-reply:delivered', (_event, data) => callback(data));
  },
  onSwitchConversation: (callback) => {
    ipcRenderer.on('conversation:switch', (_event, data) => callback(data));
  },

  // Methods used inside quick-reply notification window
  sendQuickReplyAction: (data) => ipcRenderer.invoke('quick-reply:send-action', data),
  openAppFromNotification: (data) => ipcRenderer.invoke('quick-reply:open-app', data),
  onQuickReplyLoad: (callback) => {
    ipcRenderer.on('quick-reply:load', (_event, data) => callback(data));
  },

  // Auto-updater desktop methods
  getAppVersion: () => ipcRenderer.invoke('updater:get-state').then(s => s?.version || '3.1.0'),
  getUpdaterState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('updater:status-changed', handler);
    return () => ipcRenderer.removeListener('updater:status-changed', handler);
  }
});
