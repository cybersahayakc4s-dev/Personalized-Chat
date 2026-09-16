// Utility to detect if the client is executing inside Electron desktop shell
// Relies on contextBridge exposed API, never on user-agent sniffing

export interface DesktopQuickReplyData {
  senderName: string;
  senderHandle?: string;
  senderAvatar?: string;
  messagePreview: string;
  conversationId: string;
  senderId: string;
  isDark?: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  getRefreshToken: () => Promise<string | null>;
  setRefreshToken: (token: string) => Promise<boolean>;
  clearRefreshToken: () => Promise<boolean>;
  resize?: (width: number, height: number) => Promise<boolean>;
  isAppMinimized?: () => Promise<boolean>;
  showDesktopQuickReply?: (data: DesktopQuickReplyData) => Promise<boolean>;
  closeDesktopQuickReply?: () => Promise<boolean>;
  onQuickReplySend?: (callback: (data: { conversationId: string; content: string }) => void) => void;
  onSwitchConversation?: (callback: (data: { conversationId: string }) => void) => void;
  sendQuickReplyAction?: (data: { conversationId: string; content: string }) => Promise<boolean>;
  openAppFromNotification?: (data: { conversationId: string }) => Promise<boolean>;
  onQuickReplyLoad?: (callback: (data: DesktopQuickReplyData) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);
}

export function getElectronApi(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
}
