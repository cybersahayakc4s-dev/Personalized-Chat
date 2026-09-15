import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User,
  Channel,
  DirectMessage,
  Message,
  AuditLog,
  WorkspaceSettings,
  UserStatus,
  UserAccountStatus,
  ChannelType,
  TeamId,
  Attachment,
  FormattingFormat,
  NotificationPreferences,
  QuickReplyState
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_CHANNELS,
  INITIAL_DMS,
  INITIAL_MESSAGES,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS,
  TEAMS_META
} from '../data/initialData';
import { sounds } from '../utils/audio';
import { api, getStoredToken, setStoredToken, setStoredTokens, getStoredRefreshToken, clearStoredAuth, getServerBaseUrl, setServerBaseUrl } from '../services/api';
import { getSocket, disconnectSocket } from '../services/socket';
import { ToastMessage } from '../components/common/Toast';
import {
  isChannelAuthorized,
  getUserDepartmentChannel,
  getAuthorizedConversationOnSessionChange,
  getTeamNameFromConversationId
} from '../utils/rbac';
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  sendTestDesktopNotification,
  showIncomingMessageNotification,
  showMissedMessagesNotification,
  NotificationPermissionStatus,
  closeNotificationsForConversation
} from '../services/desktopNotification';

export interface UnauthorizedModalData {
  isOpen: boolean;
  teamName?: string;
  teamId?: string;
  reason?: string;
}

interface ChatContextType {
  currentUser: User;
  users: User[];
  channels: Channel[];
  directMessages: DirectMessage[];
  messages: Message[];
  auditLogs: AuditLog[];
  settings: WorkspaceSettings;
  activeConversationId: string;
  activeConversation: Channel | (DirectMessage & { otherUser: User }) | null;
  isDm: boolean;
  visibleDMs: (DirectMessage & { otherUser: User; lastMessage?: Message; unreadCount: number })[];
  visibleChannels: Channel[];
  unreadCounts: Record<string, number>;
  teamDirectories: any[];
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  dismissToast: (id: string) => void;
  unauthorizedModalData: UnauthorizedModalData | null;
  setUnauthorizedModalData: (data: UnauthorizedModalData | null) => void;
  openUnauthorizedModal: (teamName?: string, teamId?: string, reason?: string) => void;
  canPostInCurrentConversation: boolean;
  isCurrentConversationAccessible: boolean;
  inaccessibilityReason?: string;
  activeThreadMessageId: string | null;
  pinnedDrawerOpen: boolean;
  membersDrawerOpen: boolean;
  adminModalOpen: boolean;
  newChannelModalOpen: boolean;
  newDmModalOpen: boolean;
  searchModalOpen: boolean;
  loginModalOpen: boolean;
  profileModalUser: User | null;
  typingUsers: User[];
  sidebarMobileOpen: boolean;
  isAuthenticated: boolean;

  theme: 'whatsapp' | 'slate' | 'nordic';
  setTheme: (theme: 'whatsapp' | 'slate' | 'nordic') => void;

  // Setters / UI actions
  setActiveConversationId: (id: string) => void;
  setActiveThreadMessageId: (id: string | null) => void;
  setPinnedDrawerOpen: (open: boolean) => void;
  setMembersDrawerOpen: (open: boolean) => void;
  setAdminModalOpen: (open: boolean) => void;
  setNewChannelModalOpen: (open: boolean) => void;
  setNewDmModalOpen: (open: boolean) => void;
  setSearchModalOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  highlightedMessageId: string | null;
  setHighlightedMessageId: (id: string | null) => void;
  setLoginModalOpen: (open: boolean) => void;
  setProfileModalUser: (user: User | null) => void;
  setSidebarMobileOpen: (open: boolean) => void;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;

  // Chat Actions
  sendMessage: (content: string, attachments?: Attachment[], replyToId?: string, format?: FormattingFormat) => Promise<void>;
  retrySendMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  togglePinMessage: (messageId: string) => Promise<void>;
  updateUserStatus: (status: UserStatus, customStatus?: string) => void;
  createOrOpenDm: (targetUserId: string) => void;

  // Admin Actions (strictly RBAC checked)
  createUser: (userData: { name: string; handle: string; email: string; team?: TeamId; title: string; password?: string; is_team_leader?: boolean; is_main_admin?: boolean; current_admin_password?: string }) => Promise<{ success: boolean; error?: string }>;
  toggleUserActive: (userId: string) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  createChannel: (channelData: { name: string; description: string; type: ChannelType; team?: TeamId; topic?: string }) => Promise<boolean>;
  archiveChannel: (channelId: string) => boolean;
  updateSettings: (newSettings: Partial<WorkspaceSettings>) => Promise<void>;
  resetWorkspaceData: () => void;

  // Desktop Notifications (Windows Popups) & Preferences
  desktopNotificationPermission: NotificationPermissionStatus;
  requestDesktopNotificationPermission: () => Promise<NotificationPermissionStatus>;
  sendTestDesktopNotification: () => void;
  notificationSettingsModalOpen: boolean;
  setNotificationSettingsModalOpen: (open: boolean) => void;
  notificationPreferences: NotificationPreferences;
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void;

  // Fast Reply / Quick Reply Popup
  quickReplyState: QuickReplyState;
  openQuickReply: (data: Omit<QuickReplyState, 'isOpen'>) => void;
  closeQuickReply: () => void;
  sendQuickReply: (conversationId: string, content: string, silent?: boolean) => Promise<void>;
}

const STORAGE_KEYS = {
  USERS: 'personalize_chat_users_v2',
  CHANNELS: 'personalize_chat_channels_v2',
  DMS: 'personalize_chat_dms_v2',
  MESSAGES: 'personalize_chat_messages_v2',
  AUDIT: 'personalize_chat_audit_v2',
  SETTINGS: 'personalize_chat_settings_v2',
  CURRENT_USER_ID: 'personalize_chat_curr_user_v2',
  ACTIVE_CONV_ID: 'personalize_chat_active_conv_v2',
  PENDING_MESSAGES: 'personalize_chat_pending_messages_v1'
};

function getPendingMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingMessage(msg: Message) {
  try {
    const list = getPendingMessages().filter(m => m.id !== msg.id && m.clientId !== msg.clientId);
    list.push(msg);
    localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(list));
  } catch {}
}

function removePendingMessage(idOrClientId: string) {
  try {
    const list = getPendingMessages().filter(m => m.id !== idOrClientId && m.clientId !== idOrClientId);
    localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(list));
  } catch {}
}

function updatePendingMessageStatus(idOrClientId: string, status: 'sending' | 'failed', error?: string) {
  try {
    const list = getPendingMessages().map(m =>
      (m.id === idOrClientId || m.clientId === idOrClientId)
        ? { ...m, status, sendError: error }
        : m
    );
    localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(list));
  } catch {}
}

function generateClientMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `msg-client-${crypto.randomUUID()}`;
  }
  return `msg-client-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const ChatContext = createContext<ChatContextType | null>(null);

// Helper: map backend user to frontend User
function mapBackendUser(u: any, presenceMap: Record<string, string> = {}): User {
  const presenceRaw = presenceMap[String(u.id)] || u.presence || (u.is_online ? 'online' : (u.status === 'online' || u.status === 'busy' || u.status === 'away' ? u.status : 'offline'));
  const presence = (presenceRaw === 'busy' ? 'busy' : presenceRaw === 'away' ? 'away' : presenceRaw === 'online' ? 'online' : 'offline') as UserStatus;
  const role = u.is_main_admin ? 'main_admin' : 'member';
  const handle = u.email ? u.email.split('@')[0] : `user${u.id}`;
  let title = 'Team Member';
  if (u.is_main_admin) title = 'Platform Lead & Main Admin';
  else if (u.is_team_leader) title = 'Team Lead';

  const isDeleted = u.status === 'deleted' || u.account_status === 'deleted' || u.name === '[Deleted User]' || (u.email && u.email.includes('@archived.internal'));
  const isDisabled = !isDeleted && (u.status === 'disabled' || u.account_status === 'disabled' || u.is_active === false);
  const accountStatus: UserAccountStatus = isDeleted ? 'deleted' : (isDisabled ? 'disabled' : 'active');
  const isAccountActive = accountStatus === 'active';

  return {
    id: `usr_${u.id}`,
    name: u.name,
    handle,
    email: u.email,
    role,
    team: (u.team as TeamId) || undefined,
    status: presence,
    presence: presence,
    account_status: accountStatus,
    title,
    joinedAt: u.created_at || new Date().toISOString(),
    isActive: isAccountActive,
    is_team_leader: Boolean(u.is_team_leader),
    unreadCount: typeof u.unread_count === 'number' ? u.unread_count : 0,
    lastMessage: u.last_message,
    lastMessageTime: u.last_message_time
  };
}

// Helper: map backend message to frontend Message
function mapBackendMessage(m: any, defaultConvId: string): Message {
  let convId = defaultConvId;
  if (m.format === 'channel:announcements' || m.format === 'announcement') {
    convId = 'c-announcements';
  } else if (m.format === 'channel:updates' || m.format === 'updates') {
    convId = 'c-updates';
  } else if (m.team) {
    convId = `c-team-${m.team.replace('team_', '')}`;
    if (m.team === 'hr_admin') convId = 'c-hr-admin';
    if (m.team === 'seo') convId = 'c-seo';
    if (m.team === 'coordination') convId = 'c-coordination';
    if (m.team === 'team_ai') convId = 'c-team-ai';
    if (m.team === 'team_legal') convId = 'c-team-legal';
  } else if (m.receiver_id && m.sender_id) {
    const p1 = Math.min(m.sender_id, m.receiver_id);
    const p2 = Math.max(m.sender_id, m.receiver_id);
    convId = `dm-${p1}-${p2}`;
  }

  const hasBold = /\*\*.*?\*\*|__.*?__/.test(m.content || '');
  const hasItalic = /(?<!\*)\*(?!\*).*?(?<!\*)\*(?!\*)|(?<!_)_(?!_).*?(?<!_)_(?!_)/.test(m.content || '');
  const hasStrikethrough = /~~.*?~~|~.*?~/.test(m.content || '');
  const hasCode = /`.*?`|```[\s\S]*?```/.test(m.content || '');
  const hasQuote = /^> /m.test(m.content || '');

  // Format reactions map
  const reactionsMap: Record<string, string[]> = {};
  if (m.reactions && typeof m.reactions === 'object') {
    for (const [emoji, uids] of Object.entries(m.reactions)) {
      if (Array.isArray(uids)) {
        reactionsMap[emoji] = uids.map(uid => String(uid).startsWith('usr_') ? String(uid) : `usr_${uid}`);
      }
    }
  }

  // Format attachments
  const currentToken = getStoredToken();
  const tokenParam = currentToken ? `?token=${encodeURIComponent(currentToken)}` : '';
  const attachments: Attachment[] = (m.attachments || []).map((att: any) => {
    const rawId = String(att.id || '');
    let viewUrl = att.url;
    if (viewUrl && !viewUrl.includes('?token=') && currentToken) {
      viewUrl = `${viewUrl}${tokenParam}`;
    } else if (!viewUrl && rawId && !rawId.startsWith('att-')) {
      viewUrl = `/api/attachments/${rawId}/view${tokenParam}`;
    } else if (!viewUrl && att.file_path) {
      viewUrl = `/uploads/${att.file_path}`;
    }

    let downloadUrl = att.download_url;
    if (downloadUrl && !downloadUrl.includes('?token=') && currentToken) {
      downloadUrl = `${downloadUrl}${tokenParam}`;
    } else if (!downloadUrl && rawId && !rawId.startsWith('att-')) {
      downloadUrl = `/api/attachments/${rawId}/download${tokenParam}`;
    }

    return {
      id: rawId,
      name: att.file_name || att.name || 'attachment',
      size: att.file_size_bytes ?? att.file_size ?? att.size ?? 0,
      type: att.mime_type || att.content_type || att.type || 'application/octet-stream',
      url: viewUrl || '#',
      downloadUrl: downloadUrl || viewUrl || '#'
    };
  });

  return {
    id: String(m.id).startsWith('msg-') ? String(m.id) : `msg-${m.id}`,
    conversationId: convId,
    senderId: String(m.sender_id).startsWith('usr_') ? String(m.sender_id) : `usr_${m.sender_id}`,
    content: m.deleted_at ? 'This message was deleted' : (m.content || ''),
    format: m.format || 'markdown',
    formatting: { hasBold, hasItalic, hasStrikethrough, hasCode, hasQuote },
    timestamp: m.created_at || new Date().toISOString(),
    editedAt: m.edited_at,
    attachments: attachments.length > 0 ? attachments : undefined,
    reactions: reactionsMap,
    replyToId: m.reply_to_id ? (String(m.reply_to_id).startsWith('msg-') ? String(m.reply_to_id) : `msg-${m.reply_to_id}`) : undefined,
    isPinned: Boolean(m.is_pinned),
    readAt: m.read_at || undefined
  };
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>(INITIAL_DMS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [settings, setSettings] = useState<WorkspaceSettings>(() => ({
    ...INITIAL_SETTINGS,
    serverUrl: getServerBaseUrl()
  }));
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return sessionStorage.getItem('chat_current_user_id') || localStorage.getItem('chat_current_user_id') || 'usr_1';
  });
  const [activeConversationId, setActiveConversationIdState] = useState<string>('c-team-ai');

  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(token));

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setToken(null);
      disconnectSocket();
      setLoginModalOpen(true);
    };

    const handleRefreshed = (e: any) => {
      const newToken = e.detail?.access_token;
      if (newToken) {
        setToken(newToken);
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('auth:refreshed', handleRefreshed);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('auth:refreshed', handleRefreshed);
    };
  }, []);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [teamDirectories, setTeamDirectories] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [desktopNotificationPermission, setDesktopNotificationPermission] =
    useState<NotificationPermissionStatus>(() => getDesktopNotificationPermission());

  const [notificationSettingsModalOpen, setNotificationSettingsModalOpen] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem('chat_notification_prefs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.scope) parsed.scope = 'all';
        return parsed;
      }
    } catch {}
    return {
      scope: 'all',
      privacyMode: false,
      soundEnabled: true,
      missedMessagesOnStartup: true
    };
  });

  const updateNotificationPreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setNotificationPreferences(prev => {
      const next = { ...prev, ...prefs };
      try {
        localStorage.setItem('chat_notification_prefs_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const [quickReplyState, setQuickReplyState] = useState<QuickReplyState>({
    isOpen: false,
    conversationId: '',
    senderId: '',
    senderName: '',
    senderHandle: '',
    messagePreview: ''
  });

  const openQuickReply = useCallback((data: Omit<QuickReplyState, 'isOpen'>) => {
    setQuickReplyState({ ...data, isOpen: true });
  }, []);

  const closeQuickReply = useCallback(() => {
    setQuickReplyState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const recentQuickRepliesRef = useRef<Map<string, number>>(new Map());
  const inFlightQuickRepliesRef = useRef<Set<string>>(new Set());

  const sendQuickReply = useCallback(async (targetConvId: string, content: string, silent: boolean = false) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // Strict Idempotency Check: prevent duplicate rapid sends of identical content
    const dedupeKey = `${targetConvId}:${trimmed}`;
    const now = Date.now();
    const lastSent = recentQuickRepliesRef.current.get(dedupeKey);
    if (inFlightQuickRepliesRef.current.has(dedupeKey) || (lastSent && now - lastSent < 2500)) {
      return;
    }

    inFlightQuickRepliesRef.current.add(dedupeKey);
    recentQuickRepliesRef.current.set(dedupeKey, now);

    // Clean up old dedupe keys older than 10s
    for (const [k, timestamp] of recentQuickRepliesRef.current.entries()) {
      if (now - timestamp > 10000) {
        recentQuickRepliesRef.current.delete(k);
      }
    }

    let teamName: string | undefined = undefined;
    let recipientId: string | undefined = undefined;
    let msgFormat = 'plain';

    if (targetConvId.startsWith('dm-')) {
      const parts = targetConvId.replace('dm-', '').split('-');
      const currentNumeric = currentUserIdRef.current.replace('usr_', '');
      const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
      recipientId = otherNumeric;
    } else if (targetConvId === 'c-announcements') {
      const me = usersRef.current.find(u => u.id === currentUserIdRef.current);
      if (me?.role !== 'main_admin') {
        console.warn('[RBAC] Blocked quick reply to announcements by non-admin:', me?.handle);
        return;
      }
      teamName = 'coordination';
      msgFormat = 'channel:announcements';
    } else if (targetConvId === 'c-updates') {
      const me = usersRef.current.find(u => u.id === currentUserIdRef.current);
      const isLeadOrAdmin = me?.role === 'main_admin' || Boolean(me?.is_team_leader) || Boolean(me?.title && me.title.toLowerCase().includes('lead'));
      if (!isLeadOrAdmin) {
        console.warn('[RBAC] Blocked quick reply to updates by non-lead:', me?.handle);
        return;
      }
      teamName = 'coordination';
      msgFormat = 'channel:updates';
    } else {
      teamName = getTeamNameFromConversationId(channelsRef.current, targetConvId);
    }

    const tempId = `msg-temp-${Date.now()}`;
    const newMsg: Message = {
      id: tempId,
      conversationId: targetConvId,
      senderId: currentUserIdRef.current,
      content: trimmed,
      format: msgFormat,
      formatting: {},
      timestamp: new Date().toISOString(),
      reactions: {}
    };

    setMessages(prev => [...prev, newMsg]);
    sounds.playSend();

    try {
      const res = await api.sendMessage({
        content: trimmed,
        recipient_id: recipientId ? Number(recipientId) : undefined,
        team: teamName,
        format: msgFormat
      });

      if (res && res.id) {
        const confirmedId = String(res.id).startsWith('msg-') ? String(res.id) : `msg-${res.id}`;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: confirmedId, timestamp: res.created_at || m.timestamp } : m));
      }

      if (!silent) {
        addToast({
          type: 'success',
          title: 'Quick reply sent',
          description: `"${trimmed}"`
        });
      }
    } catch (e) {
      console.warn('sendQuickReply error:', e);
      if (!silent) {
        addToast({
          type: 'error',
          title: 'Failed to send reply',
          description: 'Could not deliver quick reply'
        });
      }
    } finally {
      setTimeout(() => {
        inFlightQuickRepliesRef.current.delete(dedupeKey);
      }, 500);
    }
  }, []);

  const handleRequestDesktopNotification = useCallback(async () => {
    const status = await requestDesktopNotificationPermission();
    setDesktopNotificationPermission(status);
    return status;
  }, []);

  const handleSendTestNotification = useCallback((param?: number | any) => {
    const delayMs = typeof param === 'number' ? param : (param?.delayMs || 0);
    const currentConv = activeConversationIdRef.current;
    let teamName: string | undefined = undefined;
    let recipientId: string | undefined = undefined;

    if (currentConv.startsWith('dm-')) {
      const parts = currentConv.replace('dm-', '').split('-');
      const currentNumeric = currentUserIdRef.current.replace('usr_', '');
      recipientId = parts[0] === currentNumeric ? parts[1] : parts[0];
    } else if (currentConv === 'c-announcements' || currentConv === 'c-updates') {
      teamName = 'coordination';
    } else {
      teamName = getTeamNameFromConversationId(channelsRef.current, currentConv) || undefined;
    }

    sendTestDesktopNotification({
      delayMs,
      conversationId: currentConv,
      recipientId,
      teamName
    });
  }, []);

  const addToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastMessage = { ...t, id };
    setToasts(prev => [...prev.slice(-4), newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, 6000);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const channelsRef = useRef(channels);
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const notificationPreferencesRef = useRef(notificationPreferences);
  useEffect(() => {
    notificationPreferencesRef.current = notificationPreferences;
  }, [notificationPreferences]);

  const disconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectToastIdRef = useRef<string | null>(null);

  // UI Drawers & Modals
  const [activeThreadMessageId, setActiveThreadMessageId] = useState<string | null>(null);
  const [pinnedDrawerOpen, setPinnedDrawerOpen] = useState<boolean>(false);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [newChannelModalOpen, setNewChannelModalOpen] = useState<boolean>(false);
  const [newDmModalOpen, setNewDmModalOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [profileModalUser, setProfileModalUser] = useState<User | null>(null);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState<boolean>(false);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [unauthorizedModalData, setUnauthorizedModalData] = useState<UnauthorizedModalData | null>(null);

  const openUnauthorizedModal = useCallback((teamName?: string, teamId?: string, reason?: string) => {
    setUnauthorizedModalData({
      isOpen: true,
      teamName,
      teamId,
      reason
    });
    sounds.playPop();
  }, []);

  const setActiveConversationId = useCallback((id: string) => {
    // Intercept and enforce RBAC dynamically on channels (KISS - simply block opening)
    const targetChannel = channels.find(c => c.id === id);
    const currUser = usersRef.current.find(u => u.id === currentUserIdRef.current);
    if (targetChannel) {
      const check = isChannelAuthorized(targetChannel, currUser);
      if (!check.authorized) {
        openUnauthorizedModal(targetChannel.name, targetChannel.team, check.reason);
        return;
      }
    }

    setActiveConversationIdState(id);
    setActiveThreadMessageId(null);
    setSidebarMobileOpen(false);
  }, [channels, openUnauthorizedModal]);

  const processedRepliesRef = useRef<Set<string>>(new Set());

  // Listen to Service Worker messages (e.g. click on Windows toast notification, inline text reply, or mark as read)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (!event.data) return;
      const { type, conversationId, content, replyId } = event.data;

      if (type === 'NAVIGATE_CONVERSATION' && conversationId) {
        setActiveConversationId(conversationId);
      } else if (type === 'INLINE_REPLY' && conversationId && content) {
        // Deduplicate using explicit replyId if provided
        const uniqueId = replyId || `${conversationId}:${content}:${Date.now()}`;
        if (processedRepliesRef.current.has(uniqueId)) return;
        processedRepliesRef.current.add(uniqueId);
        if (processedRepliesRef.current.size > 100) {
          processedRepliesRef.current.clear();
        }
        // Send silently so no redundant sent toasts pop up from background replies
        sendQuickReply(conversationId, content, true);
      } else if (type === 'OPEN_QUICK_REPLY' && conversationId) {
        setActiveConversationIdState(conversationId);
        const parts = conversationId.startsWith('dm-') ? conversationId.replace('dm-', '').split('-') : [];
        const otherNumeric = parts.length === 2 ? (parts[0] === currentUserIdRef.current.replace('usr_', '') ? parts[1] : parts[0]) : '';
        const sender = otherNumeric ? usersRef.current.find(u => u.id === `usr_${otherNumeric}`) : undefined;
        openQuickReply({
          conversationId,
          senderId: sender ? sender.id : '',
          senderName: sender ? sender.name : 'Colleague',
          senderHandle: sender?.handle,
          messagePreview: 'Replying to notification'
        });
      } else if (type === 'MARK_READ_CONVERSATION' && conversationId) {
        if (conversationId.startsWith('dm-')) {
          const parts = conversationId.replace('dm-', '').split('-');
          const currentNumeric = currentUserIdRef.current.replace('usr_', '');
          const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
          const sock = getSocket();
          if (sock && sock.connected) {
            sock.emit('chat_read', { sender_id: Number(otherNumeric) });
          }
        }
        setUnreadCounts(prev => ({ ...prev, [conversationId]: 0 }));
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [sendQuickReply, openQuickReply, setActiveConversationId]);

  // Deep-link query param listener on mount and window focus (e.g. from desktop notifications)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDeepLink = () => {
      const params = new URLSearchParams(window.location.search);
      const convParam = params.get('conv');
      if (convParam) {
        setActiveConversationId(convParam);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    };

    checkDeepLink();
    window.addEventListener('focus', checkDeepLink);
    return () => window.removeEventListener('focus', checkDeepLink);
  }, [setActiveConversationId]);

  // Keep desktopNotificationPermission synced if permission changes externally
  useEffect(() => {
    setDesktopNotificationPermission(getDesktopNotificationPermission());
  }, []);

  // Dynamic tab title showing unread count
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((acc, c) => acc + (c > 0 ? c : 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) C4S-Connector`;
    } else {
      document.title = 'C4S-Connector';
    }
  }, [unreadCounts]);

  // Startup Missed Messages Catch-Up Notification
  useEffect(() => {
    if (!isAuthenticated) return;
    const alreadyTriggered = sessionStorage.getItem('personalize_startup_catchup_done');
    if (alreadyTriggered) return;

    const timer = setTimeout(() => {
      sessionStorage.setItem('personalize_startup_catchup_done', 'true');
      if (!notificationPreferences.missedMessagesOnStartup) return;

      const totalUnread = Object.values(unreadCounts).reduce((acc, c) => acc + (c > 0 ? c : 0), 0);
      if (totalUnread > 0) {
        showMissedMessagesNotification(
          totalUnread,
          `You have ${totalUnread} unread message${totalUnread === 1 ? '' : 's'} waiting for you. Click to review.`,
          () => {
            const firstUnread = Object.keys(unreadCounts).find(k => unreadCounts[k] > 0);
            if (firstUnread) {
              setActiveConversationIdState(firstUnread);
            }
          }
        );
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, unreadCounts, notificationPreferences.missedMessagesOnStartup]);

  // Global unlock for Web Audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      sounds.resume();
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);



  const [theme, setThemeState] = useState<'whatsapp' | 'slate' | 'nordic'>(() => {
    return (localStorage.getItem('chat_theme') as any) || 'nordic';
  });

  const setTheme = useCallback((t: 'whatsapp' | 'slate' | 'nordic') => {
    setThemeState(t);
    localStorage.setItem('chat_theme', t);
  }, []);

  const presenceMapRef = useRef<Record<string, string>>({});

  // Sync sound setting
  useEffect(() => {
    sounds.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Clean legacy mock cache if needed
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.DMS);
      localStorage.removeItem('personalize_chat_users');
      localStorage.removeItem('personalize_chat_messages');
      localStorage.removeItem('personalize_chat_dms');
    } catch {
      // ignore
    }
  }, []);

  // Load initial backend data or login automatically with default admin if no token
  useEffect(() => {
    const initAuth = async () => {
      let activeTok = getStoredToken();
      if (!activeTok) {
        setIsAuthenticated(false);
        setLoginModalOpen(true);
        return;
      }

      if (activeTok) {
        try {
          const me = await api.getMe();
          if (me) {
            const uid = `usr_${me.id}`;
            setCurrentUserId(uid);
            sessionStorage.setItem('chat_current_user_id', uid);
            localStorage.setItem('chat_current_user_id', uid);
            localStorage.setItem('chat_last_active_user_id', uid);
            setActiveConversationIdState(prev =>
              getAuthorizedConversationOnSessionChange(channels, me, prev)
            );
          }

          // Fetch backend users
          try {
            const backendUsers = await api.getUsers();
            const userList: User[] = [];
            if (me) {
              const meUser = mapBackendUser(me, presenceMapRef.current);
              meUser.status = presenceMapRef.current[String(me.id)] === 'busy' ? 'busy' : 'online';
              userList.push(meUser);
            }
            const initialUnreads: Record<string, number> = {};
            if (Array.isArray(backendUsers)) {
              for (const u of backendUsers) {
                userList.push(mapBackendUser(u, presenceMapRef.current));
                if (typeof u.unread_count === 'number' && u.unread_count > 0) {
                  initialUnreads[`usr_${u.id}`] = u.unread_count;
                  if (me) {
                    const p1 = Math.min(Number(me.id), Number(u.id));
                    const p2 = Math.max(Number(me.id), Number(u.id));
                    initialUnreads[`dm-${p1}-${p2}`] = u.unread_count;
                  }
                }
              }
            }
            if (userList.length > 0) {
              const unique = Array.from(new Map(userList.map(u => [u.id, u])).values());
              setUsers(unique);
            }
            if (Object.keys(initialUnreads).length > 0) {
              setUnreadCounts(prev => ({ ...prev, ...initialUnreads }));
            }
          } catch (userErr: any) {
            console.warn('Failed to load backend users:', userErr);
            addToast({
              type: 'error',
              title: 'Failed to Load Users',
              description: userErr?.message || 'Unable to retrieve colleague directory from server.'
            });
          }
          // Fetch teams directory
          try {
            const teamsData = await api.getTeams();
            if (Array.isArray(teamsData)) {
              setTeamDirectories(teamsData);
            }
          } catch (teamsErr) {
            console.warn('Failed to load teams directory:', teamsErr);
          }

          // Fetch settings & audit logs strictly if Main-Admin
          if (me && me.is_main_admin) {
            try {
              const wsSettings = await api.getWorkspaceSettings();
              if (wsSettings) {
                setSettings(prev => ({
                  ...prev,
                  name: wsSettings.workspace_name || 'Cyber Sahayak',
                  domain: wsSettings.domain || 'cybersahayak.local',
                  retentionDays: wsSettings.retention_days || 90,
                  allowFileUploads: wsSettings.allow_file_uploads ?? true,
                  maxUploadSizeBytes: wsSettings.max_upload_size_bytes || (500 * 1024 * 1024),
                  soundEnabled: wsSettings.sound_enabled ?? true,
                  allowCustomChannels: wsSettings.allow_custom_channels ?? false
                }));
              }
            } catch (settingsErr) {
              console.warn('Failed to load workspace settings:', settingsErr);
            }

            try {
              const logs = await api.getAuditLogs();
              if (Array.isArray(logs)) {
                setAuditLogs(logs.map(l => ({
                  id: String(l.id),
                  timestamp: l.created_at,
                  actorId: `usr_${l.actor_id}`,
                  action: l.action,
                  target: l.target,
                  details: l.details,
                  ipAddress: l.ip_address || '127.0.0.1'
                })));
              }
            } catch (logsErr) {
              console.warn('Failed to load audit logs:', logsErr);
            }
          }
        } catch (err: any) {
          console.warn('Failed to load initial backend state:', err);
          addToast({
            type: 'error',
            title: 'Workspace Sync Error',
            description: err?.message || 'Could not synchronize initial workspace state.'
          });
        }
      }
    };

    initAuth();
  }, [token]);

  // Connect Socket.IO and listen for real-time events
  useEffect(() => {
    if (!token) return;

    const socket = getSocket(token);
    if (!socket) return;

    const resyncActiveConversation = async () => {
      const convId = activeConversationIdRef.current;
      const currentToken = getStoredToken();
      if (!convId || !currentToken) return;

      try {
        let freshMsgs: any[] = [];
        if (convId.startsWith('dm-')) {
          const parts = convId.replace('dm-', '').split('-');
          const currentNumeric = currentUserIdRef.current ? currentUserIdRef.current.replace('usr_', '') : '';
          const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
          if (otherNumeric) {
            freshMsgs = await api.getDMHistory(otherNumeric);
          }
        } else if (convId === 'c-announcements' || convId === 'c-updates') {
          const format = convId === 'c-announcements' ? 'channel:announcements' : 'channel:updates';
          freshMsgs = await api.getChannelHistory(format);
        } else {
          const teamName = getTeamNameFromConversationId(channelsRef.current, convId);
          if (teamName) {
            freshMsgs = await api.getTeamHistory(teamName);
          }
        }

        if (Array.isArray(freshMsgs) && freshMsgs.length > 0) {
          const mapped = freshMsgs.map(m => mapBackendMessage(m, convId));
          const relevant = mapped.filter(m => m.conversationId === convId);

          setMessages(prev => {
            const map = new Map<string, Message>();
            // Keep previous messages including pending/failed
            for (const m of prev) {
              map.set(m.id, m);
            }
            // Merge/update with fresh messages
            for (const rm of relevant) {
              const existing = map.get(rm.id);
              if (existing) {
                map.set(rm.id, { ...existing, ...rm });
              } else {
                map.set(rm.id, rm);
              }
            }
            return Array.from(map.values());
          });
        }

        // Sidebar unread badges & previews resync independently
        try {
          const backendUsers = await api.getUsers();
          if (Array.isArray(backendUsers)) {
            const updatedUnreads: Record<string, number> = {};
            const meNumeric = currentUserIdRef.current ? Number(currentUserIdRef.current.replace('usr_', '')) : null;
            setUsers(prev =>
              prev.map(u => {
                const numId = Number(u.id.replace('usr_', ''));
                const fresh = backendUsers.find((bu: any) => bu.id === numId);
                if (fresh) {
                  if (typeof fresh.unread_count === 'number' && fresh.unread_count > 0) {
                    updatedUnreads[`usr_${fresh.id}`] = fresh.unread_count;
                    if (meNumeric !== null) {
                      const p1 = Math.min(meNumeric, fresh.id);
                      const p2 = Math.max(meNumeric, fresh.id);
                      updatedUnreads[`dm-${p1}-${p2}`] = fresh.unread_count;
                    }
                  }
                  return {
                    ...u,
                    unreadCount: typeof fresh.unread_count === 'number' ? fresh.unread_count : u.unreadCount,
                    lastMessage: fresh.last_message !== undefined ? fresh.last_message : u.lastMessage,
                    lastMessageTime: fresh.last_message_time !== undefined ? fresh.last_message_time : u.lastMessageTime
                  };
                }
                return u;
              })
            );
            if (Object.keys(updatedUnreads).length > 0) {
              setUnreadCounts(prev => ({ ...prev, ...updatedUnreads }));
            }
          }
        } catch (sidebarErr) {
          console.warn('Failed to resync sidebar states:', sidebarErr);
        }
      } catch (err) {
        console.warn('Failed to resync messages on reconnect:', err);
      }
    };

    const handleDisconnectOrError = () => {
      if (!disconnectTimeoutRef.current) {
        disconnectTimeoutRef.current = setTimeout(() => {
          if (!socket.connected && !disconnectToastIdRef.current) {
            disconnectToastIdRef.current = addToast({
              type: 'error',
              title: 'Connection Lost',
              description: 'Real-time connection to chat server lost for over 10 seconds. Attempting to reconnect...'
            });
          }
        }, 10000);
      }
    };

    const handleConnect = () => {
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      if (disconnectToastIdRef.current) {
        dismissToast(disconnectToastIdRef.current);
        disconnectToastIdRef.current = null;
        addToast({
          type: 'success',
          title: 'Reconnected',
          description: 'Real-time connection restored successfully.'
        });
      }
      socket.emit('presence_set_status', { status: 'online' });
      socket.emit('presence_get');
      resyncActiveConversation();
    };

    const handleFocus = () => {
      if (socket && socket.connected) {
        socket.emit('presence_get');
      }
      resyncActiveConversation();
    };

    if (socket.connected) {
      handleConnect();
    }
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnectOrError);
    socket.on('connect_error', handleDisconnectOrError);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', resyncActiveConversation);

    const presenceInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('presence_get');
      }
    }, 8000);


    socket.on('presence:update', (data: { online_user_ids: number[]; presence: Record<string, string> }) => {
      if (data && data.presence) {
        presenceMapRef.current = data.presence;
        setUsers(prev =>
          prev.map(u => {
            const numericId = u.id.replace('usr_', '');
            const rawStatus = data.presence[numericId] || data.presence[String(numericId)];
            const isOnlineById = Array.isArray(data.online_user_ids) && (
              data.online_user_ids.includes(Number(numericId)) ||
              data.online_user_ids.includes(numericId as any)
            );
            const isSelf = u.id === currentUserIdRef.current;

            let mappedStatus: UserStatus = 'offline';
            if (rawStatus === 'busy') {
              mappedStatus = 'busy';
            } else if (rawStatus === 'online' || isOnlineById || isSelf) {
              mappedStatus = 'online';
            }

            return {
              ...u,
              status: mappedStatus,
              presence: mappedStatus
            };
          })
        );
      }
    });

    socket.on('message:receive', (msgPayload: any) => {
      const incoming = mapBackendMessage(msgPayload, activeConversationIdRef.current);
      setMessages(prev => {
        // 1. If exact id already exists, update it in place and purge any matching client/temp message
        if (prev.some(m => m.id === incoming.id)) {
          const match = prev.find(m => (m.id.startsWith('msg-temp-') || m.id.startsWith('msg-client-')) && m.senderId === incoming.senderId && m.content.trim() === incoming.content.trim());
          if (match) removePendingMessage(match.clientId || match.id);
          return prev
            .filter(m => !((m.id.startsWith('msg-temp-') || m.id.startsWith('msg-client-')) && m.senderId === incoming.senderId && m.content.trim() === incoming.content.trim()))
            .map(m => m.id === incoming.id ? incoming : m);
        }

        // 2. Check if there is an optimistic client/temp message with matching content and sender
        const tempIdx = prev.findIndex(m =>
          (m.id.startsWith('msg-temp-') || m.id.startsWith('msg-client-')) &&
          m.senderId === incoming.senderId &&
          m.content.trim() === incoming.content.trim()
        );

        if (tempIdx !== -1) {
          const tempMsg = prev[tempIdx];
          removePendingMessage(tempMsg.clientId || tempMsg.id);
          const updated = [...prev];
          updated[tempIdx] = incoming;
          return updated.filter((m, idx) => idx === tempIdx || !((m.id.startsWith('msg-temp-') || m.id.startsWith('msg-client-')) && m.senderId === incoming.senderId && m.content.trim() === incoming.content.trim()));
        }

        return [...prev, incoming];
      });

      const currConv = activeConversationIdRef.current;
      const myId = currentUserIdRef.current;
      const isFromMe = incoming.senderId === myId;


      if (!isFromMe) {
        const isWindowHidden = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
        const isDifferentConversation = incoming.conversationId !== currConv;
        const isPersonalDm = incoming.conversationId.startsWith('dm-');

        const sender = usersRef.current.find(u => u.id === incoming.senderId);
        const senderName = sender ? sender.name : (msgPayload.sender_name || 'Colleague');

        if (isDifferentConversation) {
          // Increment unread count for conversation & sender
          setUnreadCounts(prev => ({
            ...prev,
            [incoming.conversationId]: (prev[incoming.conversationId] || 0) + 1,
            [incoming.senderId]: (prev[incoming.senderId] || 0) + 1
          }));

          // Check whether the recipient user is authorized to post in this conversation
          const meUser = usersRef.current.find(u => u.id === myId);
          let userCanReply = true;
          if (incoming.conversationId === 'c-announcements') {
            userCanReply = meUser?.role === 'main_admin';
          } else if (incoming.conversationId === 'c-updates') {
            userCanReply = meUser?.role === 'main_admin' || Boolean(meUser?.is_team_leader) || Boolean(meUser?.title && meUser.title.toLowerCase().includes('lead'));
          }

          // Dispatch in-app Toast notification (only show Quick Reply action if authorized to post)
          const preview = incoming.content && incoming.content.length > 50
            ? incoming.content.slice(0, 50) + '...'
            : (incoming.content || (incoming.attachments?.length ? 'Sent an attachment' : 'Sent a message'));

          addToast({
            type: 'info',
            title: `New message from ${senderName}`,
            description: preview,
            action: userCanReply ? {
              label: 'Quick Reply',
              onClick: () => {
                openQuickReply({
                  conversationId: incoming.conversationId,
                  senderId: incoming.senderId,
                  senderName,
                  senderHandle: sender?.handle,
                  messagePreview: preview
                });
              }
            } : undefined
          });
        } else {
          // In active conversation: mark read immediately if DM
          if (isPersonalDm) {
            const otherNum = incoming.senderId.replace('usr_', '');
            const sock = getSocket();
            if (sock && sock.connected) {
              sock.emit('chat_read', { sender_id: Number(otherNum) });
            }
          }
          // Explicitly ensure unread counts are 0 for current conversation & sender
          setUnreadCounts(prev => ({
            ...prev,
            [incoming.conversationId]: 0,
            [incoming.senderId]: 0
          }));
          setUsers(prev =>
            prev.map(u => (u.id === incoming.senderId || u.id === incoming.senderId.replace('usr_', '')) ? { ...u, unreadCount: 0 } : u)
          );
          closeNotificationsForConversation(incoming.conversationId);
        }

        // Read current notification preferences via Ref (avoids stale closures)
        const currentPrefs = notificationPreferencesRef.current;

        // Play sound chime if sound enabled in preferences
        if (currentPrefs.soundEnabled !== false) {
          sounds.playReceive();
        }

        // Check scope preference (All vs DMs & Mentions vs DMs Only)
        const scope = currentPrefs.scope || 'all';
        let scopeAllowed = true;
        if (scope === 'dms_only') {
          scopeAllowed = isPersonalDm;
        } else if (scope === 'dms_and_mentions') {
          if (isPersonalDm) {
            scopeAllowed = true;
          } else {
            const myUser = usersRef.current.find(u => u.id === myId);
            const myHandle = myUser?.handle ? `@${myUser.handle}` : '';
            const myName = myUser?.name || '';
            const content = incoming.content || '';
            scopeAllowed = Boolean((myHandle && content.includes(myHandle)) || (myName && content.toLowerCase().includes(myName.toLowerCase())));
          }
        }

        // Native Windows Desktop Notification (WhatsApp style bottom-right popup):
        // Trigger if scope allowed AND (user is on a different conversation OR window is backgrounded/minimized/hidden)
        if (scopeAllowed && (isDifferentConversation || isWindowHidden)) {
          const matchedChannel = !isPersonalDm
            ? channelsRef.current.find(c => c.id === incoming.conversationId)
            : undefined;

          const otherId = isPersonalDm
            ? incoming.senderId.replace('usr_', '')
            : undefined;

          const team = !isPersonalDm
            ? (matchedChannel?.team || getTeamNameFromConversationId(channelsRef.current, incoming.conversationId) || undefined)
            : undefined;

          const meUser = usersRef.current.find(u => u.id === myId);
          let notifCanReply = true;
          if (incoming.conversationId === 'c-announcements') {
            notifCanReply = meUser?.role === 'main_admin';
          } else if (incoming.conversationId === 'c-updates') {
            notifCanReply = meUser?.role === 'main_admin' || Boolean(meUser?.is_team_leader) || Boolean(meUser?.title && meUser.title.toLowerCase().includes('lead'));
          }

          showIncomingMessageNotification({
            senderName,
            channelName: matchedChannel ? matchedChannel.name : undefined,
            content: incoming.content,
            conversationId: incoming.conversationId,
            isDm: isPersonalDm,
            recipientId: otherId,
            teamName: team,
            canReply: notifCanReply,
            hasAttachments: Boolean(incoming.attachments?.length),
            attachmentName: incoming.attachments?.[0]?.name,
            privacyMode: Boolean(currentPrefs.privacyMode),
            onClick: () => {
              setActiveConversationId(incoming.conversationId);
            }
          });
        }
      }
    });

    socket.on('message:read_confirm', (payload: { reader_id: number; read_at: string }) => {
      const myNumeric = currentUserIdRef.current ? Number(currentUserIdRef.current.replace('usr_', '')) : null;
      if (myNumeric === null || isNaN(myNumeric)) return;
      const targetDmId = `dm-${Math.min(myNumeric, payload.reader_id)}-${Math.max(myNumeric, payload.reader_id)}`;
      setMessages(prev =>
        prev.map(m => {
          if (m.conversationId === targetDmId && m.senderId === currentUserIdRef.current) {
            return { ...m, readAt: payload.read_at };
          }
          return m;
        })
      );
    });

    socket.on('message:deleted', (delPayload: any) => {
      const targetId = String(delPayload?.id || delPayload?.message_id || '');
      if (!targetId) return;
      setMessages(prev =>
        prev.map(m => {
          if (m.id === targetId || m.id === `msg-${targetId}`) {
            return {
              ...m,
              content: 'This message was deleted',
              isDeleted: true,
              deletedAt: delPayload.deleted_at || new Date().toISOString(),
              reactions: {}
            };
          }
          return m;
        })
      );
    });

    socket.on('message:edited', (editPayload: any) => {
      const updated = mapBackendMessage(editPayload, activeConversationIdRef.current);
      setMessages(prev =>
        prev.map(m => {
          if (m.id === updated.id) {
            return {
              ...m,
              content: updated.content,
              editedAt: updated.editedAt,
              formatting: updated.formatting
            };
          }
          return m;
        })
      );
    });

    socket.on('message:reaction', (reactionPayload: { message_id: number; reactions: Record<string, number[]> }) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id === String(reactionPayload.message_id) || m.id === `msg-${reactionPayload.message_id}`) {
            const mappedReactions: Record<string, string[]> = {};
            if (reactionPayload.reactions) {
              for (const [emoji, uids] of Object.entries(reactionPayload.reactions)) {
                mappedReactions[emoji] = uids.map(uid => `usr_${uid}`);
              }
            }
            return { ...m, reactions: mappedReactions };
          }
          return m;
        })
      );
    });

    socket.on('message:pin', (pinPayload: { message_id: number; is_pinned: boolean }) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id === String(pinPayload.message_id) || m.id === `msg-${pinPayload.message_id}`) {
            return { ...m, isPinned: pinPayload.is_pinned };
          }
          return m;
        })
      );
    });

    socket.on('typing:start', (data: { user_id: number; user_name: string }) => {
      const typingUser = usersRef.current.find(u => u.id === `usr_${data.user_id}`);
      if (typingUser) {
        setTypingUsers(prev => prev.some(u => u.id === typingUser.id) ? prev : [...prev, typingUser]);
      }
    });

    socket.on('typing:stop', (data: { user_id: number }) => {
      setTypingUsers(prev => prev.filter(u => u.id !== `usr_${data.user_id}`));
    });

    socket.on('user:created', (newUserData: any) => {
      if (newUserData && newUserData.id) {
        const mapped = mapBackendUser(newUserData, presenceMapRef.current);
        setUsers(prev => {
          if (prev.some(u => u.id === mapped.id || u.email.toLowerCase() === mapped.email.toLowerCase())) {
            return prev.map(u => (u.id === mapped.id ? { ...u, ...mapped } : u));
          }
          return [...prev, mapped];
        });
      }
    });

    socket.on('user:updated', (payload: any) => {
      const updatedUser = payload?.user || payload;
      if (updatedUser && updatedUser.id) {
        const targetId = String(updatedUser.id);
        setUsers(prev => prev.map(u => {
          if (u.id === targetId || u.id === `usr_${targetId}`) {
            return {
              ...u,
              name: updatedUser.name ?? u.name,
              team: updatedUser.team ?? u.team,
              role: updatedUser.role ?? u.role,
              is_team_leader: updatedUser.is_team_leader !== undefined ? updatedUser.is_team_leader : u.is_team_leader,
              isActive: updatedUser.status !== undefined ? updatedUser.status === 'active' : u.isActive,
              account_status: updatedUser.status ?? u.account_status,
            };
          }
          return u;
        }));
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('presence:update');
      socket.off('message:receive');
      socket.off('message:read_confirm');
      socket.off('message:deleted');
      socket.off('message:edited');
      socket.off('message:reaction');
      socket.off('message:pin');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('user:created');
      socket.off('user:updated');
      if (disconnectTimeoutRef.current) {
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;
      }
      clearInterval(presenceInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', resyncActiveConversation);
    };
  }, [token, addToast, setActiveConversationId]);


  // Fetch messages from backend when activeConversationId changes
  useEffect(() => {
    if (!token) return;

    // Clear unread count for current conversation & inform backend
    setUnreadCounts(prev => {
      const updated = { ...prev, [activeConversationId]: 0 };
      if (activeConversationId.startsWith('dm-')) {
        const parts = activeConversationId.replace('dm-', '').split('-');
        const currentNumeric = currentUserId.replace('usr_', '');
        const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
        if (otherNumeric) {
          const otherUserId = `usr_${otherNumeric}`;
          updated[otherUserId] = 0;
          setUsers(uList => uList.map(u => (u.id === otherUserId || u.id === otherNumeric) ? { ...u, unreadCount: 0 } : u));
          const socket = getSocket();
          if (socket && socket.connected) {
            socket.emit('chat_read', { sender_id: Number(otherNumeric) });
          }
        }
      } else if (activeConversationId !== 'c-announcements' && activeConversationId !== 'c-updates') {
        const teamName = getTeamNameFromConversationId(channels, activeConversationId);
        if (teamName) {
          const socket = getSocket();
          if (socket && socket.connected) {
            socket.emit('team_read', { team: teamName });
          }
        }
      }
      return updated;
    });

    // Close any lingering desktop notifications for this active conversation
    closeNotificationsForConversation(activeConversationId);

    const fetchHistory = async () => {
      try {
        if (activeConversationId.startsWith('dm-')) {
          // Parse DM other user ID
          const parts = activeConversationId.replace('dm-', '').split('-');
          if (parts.length >= 2) {
            const currentNumeric = currentUserId.replace('usr_', '');
            const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
            if (otherNumeric) {
              const dmMsgs = await api.getDMHistory(otherNumeric);
              if (Array.isArray(dmMsgs)) {
                const mapped = dmMsgs.map(m => mapBackendMessage(m, activeConversationId));
                const pendingForThis = getPendingMessages().filter(m => m.conversationId === activeConversationId);
                setMessages(prev => {
                  const nonDm = prev.filter(m => m.conversationId !== activeConversationId);
                  return [...nonDm, ...mapped, ...pendingForThis];
                });
              }
            }
          }
        } else if (activeConversationId === 'c-announcements' || activeConversationId === 'c-updates') {
          // Global broadcast channels (#announcements, #updates)
          const format = activeConversationId === 'c-announcements' ? 'channel:announcements' : 'channel:updates';
          const channelMsgs = await api.getChannelHistory(format);
          if (Array.isArray(channelMsgs)) {
            const mapped = channelMsgs.map(m => mapBackendMessage(m, activeConversationId));
            const relevant = mapped.filter(m => m.conversationId === activeConversationId);
            const pendingForThis = getPendingMessages().filter(m => m.conversationId === activeConversationId);
            setMessages(prev => {
              const nonThis = prev.filter(m => m.conversationId !== activeConversationId);
              return [...nonThis, ...relevant, ...pendingForThis];
            });
          }
        } else {
          // Team channel
          const teamName = getTeamNameFromConversationId(channels, activeConversationId);

          if (teamName) {
            const teamMsgs = await api.getTeamHistory(teamName);
            if (Array.isArray(teamMsgs)) {
              const mapped = teamMsgs.map(m => mapBackendMessage(m, activeConversationId));
              const relevant = mapped.filter(m => m.conversationId === activeConversationId);
              const pendingForThis = getPendingMessages().filter(m => m.conversationId === activeConversationId);
              setMessages(prev => {
                const nonThis = prev.filter(m => m.conversationId !== activeConversationId);
                return [...nonThis, ...relevant, ...pendingForThis];
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Failed to load message history from backend:', err);
        addToast({
          type: 'error',
          title: 'Failed to Load Conversation',
          description: err?.message || 'Could not retrieve message history from server.'
        });
      }
    };

    fetchHistory();
  }, [activeConversationId, token, currentUserId]);

  // Current user object
  const currentUser = useMemo(() => {
    return users.find(u => u.id === currentUserId) || users[0] || INITIAL_USERS[0];
  }, [users, currentUserId]);

  // Visible DMs (strictly user participant scoped)
  const visibleDMs = useMemo(() => {
    const list: (DirectMessage & { otherUser: User; lastMessage?: Message; unreadCount: number })[] = [];
    const currentNumeric = currentUser.id.replace('usr_', '');

    for (const u of users) {
      if (u.id === currentUser.id) continue;
      const otherNumeric = u.id.replace('usr_', '');
      const p1 = Math.min(Number(currentNumeric), Number(otherNumeric));
      const p2 = Math.max(Number(currentNumeric), Number(otherNumeric));
      const dmId = `dm-${p1}-${p2}`;

      const dmMessages = messages.filter(m => m.conversationId === dmId);
      const lastMessage = dmMessages.length > 0 ? dmMessages[dmMessages.length - 1] : undefined;
      const isActive = activeConversationId === dmId;
      const unreadCount = isActive ? 0 : (unreadCounts[dmId] !== undefined ? unreadCounts[dmId] : (unreadCounts[u.id] !== undefined ? unreadCounts[u.id] : 0));

      list.push({
        id: dmId,
        participants: [currentUser.id, u.id],
        createdAt: u.joinedAt,
        updatedAt: u.joinedAt,
        otherUser: u,
        lastMessage,
        unreadCount
      });
    }

    return list;
  }, [users, currentUser.id, messages, unreadCounts]);

  // Visible Channels
  const visibleChannels = useMemo(() => {
    return channels.filter(channel => !channel.isArchived);
  }, [channels]);

  // Conversation accessibility checks
  const { isAccessible, reason } = useMemo(() => {
    const isDirectMessage = activeConversationId.startsWith('dm-');
    if (isDirectMessage) {
      const parts = activeConversationId.replace('dm-', '').split('-');
      const currentNumeric = currentUser.id.replace('usr_', '');
      if (parts.length >= 2 && !parts.includes(currentNumeric)) {
        return {
          isAccessible: false,
          reason: '🔒 Private Conversation: Zero-backdoor privacy enforced. Only direct participants can view or post to this 1:1 conversation.'
        };
      }
      return { isAccessible: true, reason: undefined };
    }

    const channel = channels.find(c => c.id === activeConversationId);
    if (!channel) return { isAccessible: true, reason: undefined };

    const check = isChannelAuthorized(channel, currentUser);
    if (!check.authorized) {
      const teamMeta = channel.team ? (TEAMS_META as any)[channel.team] : undefined;
      const teamName = teamMeta?.name || channel.name || channel.team || 'Department';
      return {
        isAccessible: false,
        reason: check.reason || `You are not authorized to access this department. This channel is restricted to members of ${teamName} and Main-Admin.`
      };
    }

    return { isAccessible: true, reason: undefined };
  }, [activeConversationId, channels, currentUser]);

  const isCurrentConversationAccessible = isAccessible;
  const inaccessibilityReason = reason;

  // Active Conversation
  const isDm = activeConversationId.startsWith('dm-');
  const activeConversation = useMemo(() => {
    if (isDm) {
      const parts = activeConversationId.replace('dm-', '').split('-');
      const currentNumeric = currentUser.id.replace('usr_', '');
      const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
      const otherUser = users.find(u => u.id === `usr_${otherNumeric}` || u.id === otherNumeric) || {
        id: `usr_${otherNumeric}`,
        name: 'Colleague',
        handle: `user${otherNumeric}`,
        email: '',
        role: 'member' as const,
        team: 'team_ai' as const,
        status: 'offline' as const,
        title: 'Team Member',
        joinedAt: '',
        isActive: true
      };
      return {
        id: activeConversationId,
        participants: [currentUser.id, `usr_${otherNumeric}`] as [string, string],
        createdAt: '',
        updatedAt: '',
        otherUser
      };
    } else {
      return channels.find(c => c.id === activeConversationId) || null;
    }
  }, [isDm, activeConversationId, channels, currentUser.id, users]);

  // Can Post
  const canPostInCurrentConversation = useMemo(() => {
    if (isDm) {
      const otherUser = (activeConversation as any)?.otherUser;
      if (otherUser && (
        otherUser.account_status === 'deleted' ||
        otherUser.status === 'deleted' ||
        otherUser.name === '[Deleted User]' ||
        otherUser.handle?.startsWith('deleted_') ||
        (otherUser.email && otherUser.email.includes('@archived.internal')) ||
        otherUser.account_status === 'disabled' ||
        otherUser.status === 'disabled' ||
        otherUser.isActive === false
      )) {
        return false;
      }
      return true;
    }

    const channel = channels.find(c => c.id === activeConversationId);
    if (!channel) return false;

    if (activeConversationId === 'c-announcements' || channel.type === 'announcement') {
      return currentUser.role === 'main_admin';
    }

    if (activeConversationId === 'c-updates') {
      return currentUser.role === 'main_admin' || Boolean(currentUser.is_team_leader) || (currentUser.title && currentUser.title.toLowerCase().includes('lead'));
    }

    if (channel.type === 'team' && channel.team) {
      return currentUser.team === channel.team || currentUser.role === 'main_admin';
    }

    return true;
  }, [isCurrentConversationAccessible, isDm, channels, activeConversationId, currentUser]);

  // Login handler
  const login = useCallback(async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    if (res && res.access_token) {
      try {
        setStoredTokens(res.access_token, res.refresh_token);
        setToken(res.access_token);
        setIsAuthenticated(true);
        disconnectSocket();
        const socket = getSocket(res.access_token);
        if (socket) {
          socket.emit('presence_set_status', { status: 'online' });
          socket.emit('presence_get');
        }

        const me = await api.getMe();
        if (me) {
          const uid = `usr_${me.id}`;
          setCurrentUserId(uid);
          sessionStorage.setItem('chat_current_user_id', uid);
          localStorage.setItem('chat_current_user_id', uid);
          setActiveConversationIdState(prev =>
            getAuthorizedConversationOnSessionChange(channels, me, prev)
          );
        }
        const backendUsers = await api.getUsers();
        const userList: User[] = [];
        if (me) {
          const meUser = mapBackendUser(me, presenceMapRef.current);
          meUser.status = 'online';
          userList.push(meUser);
        }
        const initialUnreads: Record<string, number> = {};
        if (Array.isArray(backendUsers)) {
          for (const u of backendUsers) {
            userList.push(mapBackendUser(u, presenceMapRef.current));
            if (typeof u.unread_count === 'number' && u.unread_count > 0) {
              initialUnreads[`usr_${u.id}`] = u.unread_count;
              if (me) {
                const p1 = Math.min(Number(me.id), Number(u.id));
                const p2 = Math.max(Number(me.id), Number(u.id));
                initialUnreads[`dm-${p1}-${p2}`] = u.unread_count;
              }
            }
          }
        }
        if (userList.length > 0) {
          setUsers(Array.from(new Map(userList.map(u => [u.id, u])).values()));
        }
        setUnreadCounts(initialUnreads);
        sounds.playPop();
      } catch (err) {
        console.error('Failed to populate user state after login:', err);
        clearStoredAuth();
        setToken(null);
        setIsAuthenticated(false);
        disconnectSocket();
        throw err;
      }
    }
  }, [channels]);


  // Logout handler
  const logout = useCallback(async () => {
    const rf = getStoredRefreshToken();
    if (rf) {
      try {
        await api.logout(rf);
      } catch (e) {
        // Continue clearing local auth even if network fails
      }
    }
    if (currentUserId) {
      localStorage.setItem('chat_last_active_user_id', currentUserId);
    }
    clearStoredAuth();
    setToken(null);
    setIsAuthenticated(false);
    disconnectSocket();
    setLoginModalOpen(true);
  }, [currentUserId]);

  // Send Message with REST API + Socket broadcast + persistent send-failure durability
  const sendMessage = useCallback(async (content: string, attachments?: Attachment[], replyToId?: string, format?: FormattingFormat) => {
    if (!content.trim() && (!attachments || attachments.length === 0)) return;

    const trimmed = content.trim();
    const hasBold = /\*\*.*?\*\*|__.*?__/.test(trimmed);
    const hasItalic = /(?<!\*)\*(?!\*).*?(?<!\*)\*(?!\*)|(?<!_)_(?!_).*?(?<!_)_(?!_)/.test(trimmed);
    const hasStrikethrough = /~~.*?~~|~.*?~/.test(trimmed);
    const hasCode = /`.*?`|```[\s\S]*?```/.test(trimmed);
    const hasQuote = /^> /m.test(trimmed);

    const clientId = generateClientMessageId();
    const newMsg: Message = {
      id: clientId,
      clientId: clientId,
      status: 'sending',
      conversationId: activeConversationId,
      senderId: currentUser.id,
      content: trimmed,
      format: format || 'markdown',
      formatting: { hasBold, hasItalic, hasStrikethrough, hasCode, hasQuote },
      timestamp: new Date().toISOString(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      reactions: {},
      replyToId: replyToId || (activeThreadMessageId ? activeThreadMessageId : undefined)
    };

    // Optimistic add & persistent pending storage
    savePendingMessage(newMsg);
    setMessages(prev => [...prev, newMsg]);
    sounds.playSend();

    try {
      let teamName: string | undefined = undefined;
      let recipientId: string | undefined = undefined;
      let msgFormat = format || 'markdown';

      if (activeConversationId.startsWith('dm-')) {
        const parts = activeConversationId.replace('dm-', '').split('-');
        const currentNumeric = currentUser.id.replace('usr_', '');
        const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
        recipientId = otherNumeric;
      } else if (activeConversationId === 'c-announcements') {
        teamName = undefined;
        msgFormat = 'channel:announcements';
      } else if (activeConversationId === 'c-updates') {
        teamName = undefined;
        msgFormat = 'channel:updates';
      } else {
        teamName = getTeamNameFromConversationId(channels, activeConversationId);
      }

      const rawFileAttachments = (attachments || []).filter(a => a.rawFile);
      if (rawFileAttachments.length > 0) {
        try {
          for (let i = 0; i < rawFileAttachments.length; i++) {
            const fileAtt = rawFileAttachments[i];
            const formData = new FormData();
            formData.append('file', fileAtt.rawFile as File);
            if (recipientId) {
              formData.append('receiver_id', recipientId);
            }
            if (teamName) {
              formData.append('team', teamName);
            }
            if (msgFormat) {
              formData.append('format', msgFormat);
            }
            if (i === 0 && trimmed) {
              formData.append('content', trimmed);
            }

            const res = await api.uploadAttachment(formData);
            if (res && res.id) {
              removePendingMessage(clientId);
              const serverMsg = mapBackendMessage(res, activeConversationId);
              setMessages(prev => {
                if (prev.some(m => m.id === serverMsg.id)) {
                  return prev.filter(m => m.id !== clientId && m.clientId !== clientId && !(m.id.startsWith('msg-temp-') && m.senderId === serverMsg.senderId));
                }
                return prev.map(m => (m.id === clientId || m.clientId === clientId) ? serverMsg : m);
              });
            }
          }
        } catch (uploadErr: any) {
          console.error('File upload failed:', uploadErr);
          updatePendingMessageStatus(clientId, 'failed', uploadErr?.message || 'Could not upload file');
          setMessages(prev =>
            prev.map(m => (m.id === clientId || m.clientId === clientId) ? { ...m, status: 'failed', sendError: uploadErr?.message || 'Could not upload file' } : m)
          );
          addToast({
            type: 'error',
            title: 'File Upload Failed',
            description: uploadErr?.message || 'Could not upload file to server.'
          });
        }
        return;
      }

      const numericReplyTo = replyToId ? Number(replyToId.replace('msg-', '')) : undefined;

      const res = await api.sendMessage({
        content: trimmed,
        team: teamName,
        recipient_id: recipientId,
        format: msgFormat,
        reply_to_id: numericReplyTo ? String(numericReplyTo) : undefined,
        attachment_ids: attachments?.map(a => a.id)
      });

      if (res && res.id) {
        removePendingMessage(clientId);
        const serverMsg = mapBackendMessage(res, activeConversationId);
        setMessages(prev => {
          // If socket already added serverMsg, remove the temp message and any matching temp signature
          if (prev.some(m => m.id === serverMsg.id)) {
            return prev.filter(m => m.id !== clientId && m.clientId !== clientId && !(m.id.startsWith('msg-temp-') && m.senderId === serverMsg.senderId && m.content.trim() === serverMsg.content.trim()));
          }
          // Otherwise replace clientId with serverMsg
          return prev.map(m => (m.id === clientId || m.clientId === clientId) ? serverMsg : m);
        });
      }

    } catch (err: any) {
      console.warn('API send failed, persisting failed state:', err);
      updatePendingMessageStatus(clientId, 'failed', err?.message || 'Send failed');
      setMessages(prev =>
        prev.map(m => (m.id === clientId || m.clientId === clientId) ? { ...m, status: 'failed', sendError: err?.message || 'Send failed' } : m)
      );
      addToast({
        type: 'error',
        title: 'Message failed to send',
        description: 'Network or server error. Click Retry on the message to send again.'
      });
    }
  }, [activeConversationId, currentUser.id, activeThreadMessageId, channels, addToast]);

  // Retry sending an unsent or failed message
  const retrySendMessage = useCallback(async (messageId: string) => {
    const target = messages.find(m => m.id === messageId || m.clientId === messageId);
    if (!target) return;

    const clientId = target.clientId || target.id;
    updatePendingMessageStatus(clientId, 'sending');
    setMessages(prev =>
      prev.map(m => (m.id === messageId || m.clientId === messageId) ? { ...m, status: 'sending', sendError: undefined } : m)
    );

    try {
      let teamName: string | undefined = undefined;
      let recipientId: string | undefined = undefined;
      let msgFormat = target.format || 'markdown';

      if (target.conversationId.startsWith('dm-')) {
        const parts = target.conversationId.replace('dm-', '').split('-');
        const currentNumeric = currentUser.id.replace('usr_', '');
        const otherNumeric = parts[0] === currentNumeric ? parts[1] : parts[0];
        recipientId = otherNumeric;
      } else if (target.conversationId === 'c-announcements') {
        teamName = undefined;
        msgFormat = 'channel:announcements';
      } else if (target.conversationId === 'c-updates') {
        teamName = undefined;
        msgFormat = 'channel:updates';
      } else {
        teamName = getTeamNameFromConversationId(channels, target.conversationId);
      }

      const numericReplyTo = target.replyToId ? Number(target.replyToId.replace('msg-', '')) : undefined;

      const res = await api.sendMessage({
        content: target.content,
        team: teamName,
        recipient_id: recipientId,
        format: msgFormat,
        reply_to_id: numericReplyTo ? String(numericReplyTo) : undefined,
        attachment_ids: target.attachments?.map(a => a.id)
      });

      if (res && res.id) {
        removePendingMessage(clientId);
        const serverMsg = mapBackendMessage(res, target.conversationId);
        setMessages(prev => {
          if (prev.some(m => m.id === serverMsg.id)) {
            return prev.filter(m => m.id !== clientId && m.clientId !== clientId);
          }
          return prev.map(m => (m.id === clientId || m.clientId === clientId) ? serverMsg : m);
        });
      }
    } catch (err: any) {
      console.warn('Retry send failed:', err);
      updatePendingMessageStatus(clientId, 'failed', err?.message || 'Send failed');
      setMessages(prev =>
        prev.map(m => (m.id === clientId || m.clientId === clientId) ? { ...m, status: 'failed', sendError: err?.message || 'Send failed' } : m)
      );
      addToast({
        type: 'error',
        title: 'Retry failed',
        description: err?.message || 'Could not send message to server.'
      });
    }
  }, [messages, currentUser.id, channels, addToast]);

  // Edit Message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    const trimmed = newContent.trim();
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, content: trimmed, editedAt: new Date().toISOString() } : m))
    );

    const numericId = messageId.replace('msg-', '');
    try {
      await api.editMessage(numericId, trimmed);
    } catch (e) {
      console.warn('Edit message API failed:', e);
    }
  }, []);

  // Delete Message
  const deleteMessage = useCallback(async (messageId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              content: 'This message was deleted',
              isDeleted: true,
              deletedAt: new Date().toISOString(),
              reactions: {}
            }
          : m
      )
    );

    const numericId = messageId.replace('msg-', '');
    try {
      await api.deleteMessage(numericId);
    } catch (e) {
      console.warn('Delete message API failed:', e);
    }
  }, []);

  // Toggle Reaction
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const currentReactions = { ...msg.reactions };
          const userList = currentReactions[emoji] || [];
          const hasReacted = userList.includes(currentUser.id);

          if (hasReacted) {
            currentReactions[emoji] = userList.filter(id => id !== currentUser.id);
            if (currentReactions[emoji].length === 0) {
              delete currentReactions[emoji];
            }
          } else {
            currentReactions[emoji] = [...userList, currentUser.id];
          }

          return { ...msg, reactions: currentReactions };
        }
        return msg;
      })
    );
    sounds.playPop();

    const numericId = messageId.replace('msg-', '');
    try {
      await api.toggleReaction(numericId, emoji);
    } catch (e) {
      console.warn('Reaction API failed:', e);
    }
  }, [currentUser.id]);

  // Toggle Pin
  const togglePinMessage = useCallback(async (messageId: string) => {
    setMessages(prev =>
      prev.map(msg => (msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg))
    );
    sounds.playPop();

    const numericId = messageId.replace('msg-', '');
    try {
      await api.togglePin(numericId);
    } catch (e) {
      console.warn('Pin API failed:', e);
    }
  }, []);

  // Update Status
  const updateUserStatus = useCallback((status: UserStatus, customStatus?: string) => {
    setUsers(prev =>
      prev.map(u =>
        u.id === currentUser.id
          ? { ...u, status, customStatus: customStatus !== undefined ? customStatus : u.customStatus }
          : u
      )
    );

    const socket = getSocket();
    if (socket) {
      socket.emit('presence_set_status', { status });
    }
  }, [currentUser.id]);

  // Create or Open DM
  const createOrOpenDm = useCallback((targetUserId: string) => {
    if (targetUserId === currentUser.id) return;

    const existingDm = directMessages.find(
      dm => dm.participants.includes(currentUser.id) && dm.participants.includes(targetUserId)
    );

    if (existingDm) {
      setActiveConversationId(existingDm.id);
    } else {
      const p1 = currentUser.id.replace('usr_', '');
      const p2 = targetUserId.replace('usr_', '');
      const newDm: DirectMessage = {
        id: `dm-${Math.min(Number(p1), Number(p2))}-${Math.max(Number(p1), Number(p2))}`,
        participants: [currentUser.id, targetUserId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setDirectMessages(prev => [newDm, ...prev]);
      setActiveConversationId(newDm.id);
    }
    setNewDmModalOpen(false);
  }, [currentUser.id, directMessages, setActiveConversationId]);

  // Admin Actions
  const createUser = useCallback(async (userData: { name: string; handle: string; email: string; team?: TeamId; title: string; password?: string; is_team_leader?: boolean; is_main_admin?: boolean; current_admin_password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== 'main_admin') {
      return { success: false, error: 'Only Main-Admin has permission to provision users.' };
    }

    const trimmedPassword = (userData.password || '').trim();
    if (!trimmedPassword) {
      return { success: false, error: 'Password is required to create a user.' };
    }

    try {
      const res = await api.adminCreateUser({
        name: userData.name,
        email: userData.email,
        password: trimmedPassword,
        team: userData.team,
        is_team_leader: Boolean(userData.is_team_leader),
        is_main_admin: Boolean(userData.is_main_admin),
        current_admin_password: userData.current_admin_password,
      });

      if (res && res.id) {
        const newUser = mapBackendUser(res, presenceMapRef.current);
        setUsers(prev => {
          if (prev.some(u => u.id === newUser.id || u.email.toLowerCase() === newUser.email.toLowerCase())) {
            return prev.map(u => (u.id === newUser.id ? newUser : u));
          }
          return [...prev, newUser];
        });
        return { success: true };
      }
      return { success: false, error: 'Failed to create user account.' };
    } catch (err: any) {
      console.warn('Admin create user failed:', err);
      return { success: false, error: err.message || 'Failed to create user. Email may already be in use.' };
    }
  }, [currentUser]);

  const toggleUserActive = useCallback(async (userId: string): Promise<boolean> => {
    if (currentUser.role !== 'main_admin') return false;
    if (userId === currentUser.id) return false;

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return false;

    const updatedActive = !targetUser.isActive;
    const numericId = userId.replace('usr_', '');

    try {
      await api.adminUpdateUser(numericId, {
        status: updatedActive ? 'active' : 'disabled'
      });

      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, isActive: updatedActive, account_status: updatedActive ? 'active' : 'disabled' } : u))
      );
      return true;
    } catch (err) {
      console.warn('Toggle user active failed:', err);
    }
    return false;
  }, [currentUser, users]);

  const deleteUser = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentUser.role !== 'main_admin') {
      return { success: false, error: 'Only Main-Admin has permission to delete users.' };
    }
    if (userId === currentUser.id) {
      return { success: false, error: 'Main-Admin cannot delete their own account.' };
    }

    const numericId = String(userId).replace('usr_', '');
    try {
      await api.adminDeleteUser(numericId);
      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? {
                ...u,
                name: '[Deleted User]',
                isActive: false,
                status: 'offline',
                account_status: 'deleted'
              }
            : u
        )
      );
      return { success: true };
    } catch (err: any) {
      console.warn('Admin delete user failed:', err);
      return { success: false, error: err.message || 'Failed to delete user.' };
    }
  }, [currentUser]);

  const createChannel = useCallback(async (channelData: { name: string; description: string; type: ChannelType; team?: TeamId; topic?: string }): Promise<boolean> => {
    if (currentUser.role !== 'main_admin') return false;

    const cleanName = channelData.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newChannel: Channel = {
      id: `c-${cleanName}`,
      name: cleanName,
      description: channelData.description,
      type: channelData.type,
      team: channelData.type === 'team' ? channelData.team : undefined,
      topic: channelData.topic || '',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.id
    };

    setChannels(prev => [...prev, newChannel]);
    setActiveConversationId(newChannel.id);
    return true;
  }, [currentUser, setActiveConversationId]);

  const archiveChannel = useCallback((channelId: string): boolean => {
    if (currentUser.role !== 'main_admin') return false;
    if (channelId === 'c-general' || channelId === 'c-announcements') return false;

    setChannels(prev =>
      prev.map(c => (c.id === channelId ? { ...c, isArchived: true } : c))
    );

    if (activeConversationId === channelId) {
      setActiveConversationId('c-general');
    }
    return true;
  }, [currentUser, activeConversationId, setActiveConversationId]);

  const updateSettings = useCallback(async (newSettings: Partial<WorkspaceSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    if (newSettings.serverUrl !== undefined) {
      setServerBaseUrl(newSettings.serverUrl);
    }
    try {
      await api.updateWorkspaceSettings({
        workspace_name: newSettings.name,
        domain: newSettings.domain,
        retention_days: newSettings.retentionDays,
        allow_file_uploads: newSettings.allowFileUploads,
        max_upload_size_bytes: newSettings.maxUploadSizeBytes,
        sound_enabled: newSettings.soundEnabled,
        allow_custom_channels: newSettings.allowCustomChannels
      });
    } catch (err) {
      console.warn('Update settings failed:', err);
    }
  }, []);

  const resetWorkspaceData = useCallback(async () => {
    try {
      if (token) {
        await api.adminResetData();
      }
    } catch (err) {
      console.warn('Backend reset data failed:', err);
    }
    localStorage.clear();
    setUsers(INITIAL_USERS);
    setChannels(INITIAL_CHANNELS);
    setDirectMessages(INITIAL_DMS);
    setMessages(INITIAL_MESSAGES);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSettings({ ...INITIAL_SETTINGS, serverUrl: '' });
    setCurrentUserId('usr_1');
    setActiveConversationIdState('c-team-ai');
  }, [token]);

  return (
    <ChatContext.Provider
      value={{
        currentUser,
        users,
        channels,
        directMessages,
        messages,
        auditLogs,
        settings,
        activeConversationId,
        activeConversation,
        isDm,
        visibleDMs,
        visibleChannels,
        unreadCounts,
        toasts,
        addToast,
        dismissToast,
        canPostInCurrentConversation,
        isCurrentConversationAccessible,
        inaccessibilityReason,
        unauthorizedModalData,
        setUnauthorizedModalData,
        openUnauthorizedModal,
        activeThreadMessageId,
        pinnedDrawerOpen,
        membersDrawerOpen,
        adminModalOpen,
        newChannelModalOpen,
        newDmModalOpen,
        searchModalOpen,
        loginModalOpen,
        profileModalUser,
        typingUsers,
        sidebarMobileOpen,
        isAuthenticated,
        theme,
        setTheme,
        teamDirectories,

        setActiveConversationId,
        setActiveThreadMessageId,
        setPinnedDrawerOpen,
        setMembersDrawerOpen,
        setAdminModalOpen,
        setNewChannelModalOpen,
        setNewDmModalOpen,
        setSearchModalOpen,
        commandPaletteOpen,
        setCommandPaletteOpen,
        highlightedMessageId,
        setHighlightedMessageId,
        setLoginModalOpen,
        setProfileModalUser,
        setSidebarMobileOpen,

        login,
        logout,
        sendMessage,
        retrySendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        togglePinMessage,
        updateUserStatus,
        createOrOpenDm,

        createUser,
        toggleUserActive,
        deleteUser,
        createChannel,
        archiveChannel,
        updateSettings,
        resetWorkspaceData,

        desktopNotificationPermission,
        requestDesktopNotificationPermission: handleRequestDesktopNotification,
        sendTestDesktopNotification: handleSendTestNotification,
        notificationSettingsModalOpen,
        setNotificationSettingsModalOpen,
        notificationPreferences,
        updateNotificationPreferences,

        quickReplyState,
        openQuickReply,
        closeQuickReply,
        sendQuickReply
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
