export type TeamId = 'team_ai' | 'team_legal' | 'hr_admin' | 'seo' | 'coordination';

export type UserRole = 'main_admin' | 'member';

export type UserPresence = 'online' | 'away' | 'busy' | 'offline';
export type UserAccountStatus = 'active' | 'disabled' | 'deleted';
export type UserStatus = UserPresence;

export interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  role: UserRole;
  team?: TeamId;
  avatarUrl?: string;
  status: UserStatus;
  presence?: UserPresence;
  account_status?: UserAccountStatus;
  customStatus?: string;
  title: string;
  joinedAt: string;
  isActive: boolean;
  is_team_leader?: boolean;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

export type ChannelType = 'public' | 'announcement' | 'team';

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: ChannelType;
  team?: TeamId;
  topic?: string;
  createdAt: string;
  createdBy: string;
  isArchived?: boolean;
}

export interface DirectMessage {
  id: string;
  participants: [string, string];
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  downloadUrl?: string;
  rawFile?: File;
}

export type FormattingFormat = 'markdown' | 'plain' | 'channel:announcements' | 'channel:updates' | string;

export interface MessageFormatting {
  hasBold?: boolean;
  hasItalic?: boolean;
  hasStrikethrough?: boolean;
  hasCode?: boolean;
  hasQuote?: boolean;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  conversationId: string; // channel id or dm id
  senderId: string;
  content: string;
  format?: FormattingFormat;
  formatting?: MessageFormatting;
  timestamp: string;
  editedAt?: string;
  attachments?: Attachment[];
  reactions: Record<string, string[]>; // emoji -> array of userIds
  replyToId?: string;
  isPinned?: boolean;
  readAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  metadata?: any;
  status?: 'sending' | 'sent' | 'failed';
  clientId?: string;
  sendError?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  action: string;
  target?: string;
  details: string;
  ipAddress: string;
}

export interface WorkspaceSettings {
  name: string;
  domain: string;
  retentionDays: number;
  allowFileUploads: boolean;
  maxUploadSizeBytes: number;
  maintenanceNotice?: string;
  soundEnabled: boolean;
  serverUrl?: string;
  allowCustomChannels?: boolean;
}

export type NotificationScope = 'all' | 'dms_and_mentions' | 'dms_only';

export interface NotificationPreferences {
  scope: NotificationScope;
  privacyMode: boolean; // hide message preview on desktop toasts
  soundEnabled: boolean;
  missedMessagesOnStartup: boolean;
}

export interface QuickReplyState {
  isOpen: boolean;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderHandle?: string;
  messagePreview?: string;
}

