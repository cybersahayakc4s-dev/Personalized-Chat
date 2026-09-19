import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { TeamBadge, RoleBadge } from '../common/Badge';
import { MessageItem } from './MessageItem';
import {
  X,
  Pin,
  Users,
  FileText,
  Download,
  Image,
  FileCode,
  FileArchive,
  File as FileIcon,
  MessageSquare,
  Paperclip
} from 'lucide-react';
import { User, Attachment } from '../../types';
import { getServerBaseUrl } from '../../services/api';
import { getTeamNameFromConversationId } from '../../utils/rbac';
import { downloadAttachmentFile } from '../../utils/download';

const resolveMediaUrl = (url?: string): string => {
  if (!url || url === '#') return '#';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = getServerBaseUrl() || (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8000');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
};

export const RightSidebar: React.FC = () => {
  const {
    rightSidebarOpen,
    setRightSidebarOpen,
    pinnedDrawerOpen,
    setPinnedDrawerOpen,
    messages,
    users,
    currentUser,
    activeConversationId,
    setActiveConversationId,
    activeConversation,
    isDm,
    createOrOpenDm,
    setProfileModalUser,
    theme,
    channels
  } = useChat() as any;

  const isOpen = rightSidebarOpen || pinnedDrawerOpen;
  if (!isOpen) return null;

  const handleClose = () => {
    if (setRightSidebarOpen) setRightSidebarOpen(false);
    if (setPinnedDrawerOpen) setPinnedDrawerOpen(false);
  };

  const isDark = theme !== 'light';

  // 1. Current conversation messages
  const currentMessages = (messages || []).filter(
    (m: any) => m.conversationId === activeConversationId
  );

  // 2. Pinned messages (excluding soft-deleted)
  const pinnedMessages = currentMessages.filter((m: any) => m.isPinned && !m.isDeleted);

  // 3. Shared Files (List view, extracting all attachments safely)
  const sharedFiles: Array<Attachment & { senderName: string; timestamp: string; messageId: string }> = [];
  currentMessages.forEach((m: any) => {
    if (m.isDeleted) return;
    let safeAtts: Attachment[] = [];
    if (Array.isArray(m.attachments)) {
      safeAtts = m.attachments;
    } else if (typeof m.attachments === 'string' && m.attachments.trim()) {
      try {
        const parsed = JSON.parse(m.attachments);
        if (Array.isArray(parsed)) safeAtts = parsed;
      } catch {
        safeAtts = [];
      }
    }

    if (safeAtts.length > 0) {
      const sender = (users || []).find((u: any) => u.id === m.senderId);
      safeAtts.forEach((att: Attachment) => {
        if (!att || typeof att !== 'object') return;
        sharedFiles.push({
          ...att,
          name: att.name || 'Attachment',
          senderName: sender?.name || 'User',
          timestamp: m.timestamp,
          messageId: m.id
        });
      });
    }
  });

  // 4. Relevant Members (Filtered to active users only; strictly isolated for department channels)
  const activeUsers = (users || []).filter((u: any) =>
    u.account_status !== 'deleted' &&
    u.status !== 'deleted' &&
    !u.is_deleted &&
    !u.name?.includes('[Deleted User]') &&
    !(u.email && u.email?.includes('@archived.internal'))
  );

  const teamChannelTeam = !isDm && ((activeConversation as any)?.type === 'team' || (activeConversation as any)?.team)
    ? ((activeConversation as any)?.team || getTeamNameFromConversationId(channels || [], activeConversation?.id))
    : null;

  const channelMembers: User[] = !isDm
    ? teamChannelTeam
      ? activeUsers.filter((u: any) => u.team === teamChannelTeam || u.role === 'main_admin')
      : activeUsers
    : [];

  const displayedMembers: User[] = channelMembers;

  const getFileIcon = (fileName: string = '', type: string = '') => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) {
      return <Image className="w-4 h-4 text-secondary flex-shrink-0" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'html', 'css'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-secondary flex-shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-secondary flex-shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-secondary flex-shrink-0" />;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer animate-in fade-in duration-150"
      />
      <aside
        className="fixed lg:static inset-y-0 right-0 z-50 w-full sm:w-80 lg:w-80 max-w-full border-l border-subtle bg-sidebar text-primary flex flex-col h-full animate-in slide-in-from-right duration-200 shadow-2xl lg:shadow-none shrink-0 select-none transition-colors">
        {/* Header (aligned with ChatArea h-16 header) */}
        <div
          className="h-16 px-5 border-b border-subtle bg-sidebar flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm tracking-tight truncate text-primary">
              {isDm ? 'Direct Chat Details' : 'Conversation Details'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-secondary hover:text-primary hover:bg-surface-hover"
            title="Close panel"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Body: 3 Organized Sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-subtle">
        
        {/* SECTION 1: PINNED MESSAGES */}
        <div className="p-3.5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Pin className="w-3.5 h-3.5 text-accent" />
              <span>Pinned Messages</span>
            </div>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded font-medium bg-surface-hover text-secondary border border-subtle"
            >
              {pinnedMessages.length}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {pinnedMessages.length === 0 ? (
              <div className="p-4 text-center rounded-lg border border-dashed border-subtle text-muted">
                <p className="text-xs font-medium">No pinned messages</p>
                <p className="text-xs mt-0.5 opacity-80">Hover any message and click pin to save it here</p>
              </div>
            ) : (
              pinnedMessages.map((msg: any) => {
                const sender = (users || []).find((u: any) => u.id === msg.senderId) || currentUser;
                let atts: any[] = [];
                try {
                  if (Array.isArray(msg.attachments)) {
                    atts = msg.attachments;
                  } else if (typeof msg.attachments === 'string' && msg.attachments) {
                    atts = JSON.parse(msg.attachments);
                  }
                } catch { atts = []; }

                const handleJumpToMessage = () => {
                  const el = document.getElementById(`msg-${msg.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-amber-500/50', 'transition-all');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500/50'), 2500);
                  }
                };

                return (
                  <div
                    key={msg.id}
                    onClick={handleJumpToMessage}
                    className="p-2.5 rounded-lg border text-xs transition bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-accent/40 hover:bg-surface-hover/50 cursor-pointer group"
                    title="Click to jump to message"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate text-[var(--text-primary)] group-hover:text-accent transition-colors">
                        {sender.name}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {msg.content ? (
                      <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)] mb-1">
                        {msg.content}
                      </p>
                    ) : null}

                    {atts.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {atts.map((att: any, idx: number) => {
                          const isImg = att.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name || att.url || '');
                          const formattedSize = att.size
                            ? (att.size > 1024 * 1024
                                ? `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                                : `${Math.round(att.size / 1024)} KB`)
                            : '';
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-hover/80 border border-subtle/50 text-[11px] text-primary truncate"
                            >
                              {isImg ? (
                                <Image className="w-3.5 h-3.5 text-accent shrink-0" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                              )}
                              <span className="truncate font-medium flex-1">{att.name || 'Attachment'}</span>
                              {formattedSize && (
                                <span className="text-[10px] text-muted shrink-0 font-mono">{formattedSize}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!msg.content && atts.length === 0 && (
                      <p className="text-xs italic text-muted">Pinned message</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 2: MEMBERS OF THE CHAT (Only for Channels / Groups; Omitted in 1:1 DMs) */}
        {!isDm && (
          <div className="p-3.5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <Users className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                <span>Members of the Chat</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium font-mono bg-surface-hover text-secondary border border-subtle">
                {channelMembers.length}
              </span>
            </div>

            <div className="space-y-1">
              {displayedMembers.map(member => {
                const isMe = member.id === currentUser?.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-1.5 rounded-md transition hover:bg-surface-hover"
                  >
                    <button
                      onClick={() => setProfileModalUser(member)}
                      className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
                    >
                      <Avatar user={member} size="xs" showStatus={true} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate text-primary">
                            {member.name}
                          </span>
                          {isMe && <span className="text-xs text-muted font-mono">(you)</span>}
                          {member.role === 'main_admin' && (
                            <span className="text-xs px-1 rounded font-mono bg-surface-hover text-secondary border border-subtle font-semibold">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary font-mono truncate">
                          {(member as any).designation || member.title || member.team || 'Member'}
                        </p>
                      </div>
                    </button>

                    {/* Member Quick Actions */}
                    {!isMe && (
                      <button
                        onClick={() => {
                          const dmConv = channels?.find((c: any) =>
                            c.type === 'dm' &&
                            c.member_ids?.includes(member.id) &&
                            c.member_ids?.includes(currentUser?.id)
                          );
                          if (dmConv) {
                            setActiveConversationId(dmConv.id);
                          } else {
                            // Fallback to synthetic DM channel ID format
                            setActiveConversationId(`dm_${member.id}`);
                          }
                          handleClose();
                        }}
                        className="p-1 rounded text-muted hover:text-accent hover:bg-surface-hover transition-colors ml-1 cursor-pointer"
                        title={`Message ${member.name}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: SHARED FILES */}
        <div className="p-3.5 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Paperclip className="w-3.5 h-3.5 text-accent" />
              <span>Shared Files</span>
            </div>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded font-medium bg-surface-hover text-secondary border border-subtle"
            >
              {sharedFiles.length}
            </span>
          </div>

          <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
            {sharedFiles.length === 0 ? (
              <div className="p-4 text-center rounded-lg border border-dashed border-subtle text-muted">
                <p className="text-xs font-medium">No files shared yet</p>
                <p className="text-xs mt-0.5">Attachments sent in this conversation will be listed here</p>
              </div>
            ) : (
              sharedFiles.map((file, idx) => (
                <div
                  key={`${file.id}-${idx}`}
                  className="flex items-center justify-between p-2 rounded-lg border transition bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-focus)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {getFileIcon(file?.name || '', file?.type || '')}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate text-[var(--text-primary)]" title={file?.name || 'Attachment'}>
                        {file?.name || 'Attachment'}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono mt-0.5">
                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span className="truncate">{file.senderName}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadAttachmentFile(file.downloadUrl || file.url, file.name)}
                    className="p-1.5 rounded-md transition-colors ml-2 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                    title={`Download ${file.name}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </aside>
  </>
);
};
