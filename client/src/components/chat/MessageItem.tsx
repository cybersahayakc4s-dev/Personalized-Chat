import React, { useState, useRef } from 'react';
import { Message, User, Attachment, TeamId } from '../../types';
import { useChat } from '../../context/ChatContext';
import { TEAMS_META } from '../../data/initialData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  Smile,
  Pin,
  Reply,
  MoreVertical,
  Check,
  Copy,
  Edit2,
  Trash2,
  FileText,
  Download,
  AlertCircle,
  Eye,
  Film,
  Music,
  X
} from 'lucide-react';
import { getServerBaseUrl } from '../../services/api';
import { getUserColorProfile, getUserNameColor } from '../../utils/userColors';
import { downloadAttachmentFile } from '../../utils/download';

export interface MessageItemProps {
  message: Message;
  sender: User;
  isOwnMessage: boolean;
  onOpenThread?: () => void;
  showThreadButton?: boolean;
  isHighlighted?: boolean;
  isGrouped?: boolean;
  className?: string;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '🚀', '🔒', '💡', '👀', '🎉'];

const resolveMediaUrl = (url?: string): string => {
  if (!url || url === '#') return '#';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = getServerBaseUrl() || (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8000');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
};

const isImageAttachment = (att: Attachment) => {
  return att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(att.name);
};

const isVideoAttachment = (att: Attachment) => {
  return att.type?.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(att.name);
};

const isAudioAttachment = (att: Attachment) => {
  return att.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(att.name);
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getInitials = (name?: string) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  sender,
  isOwnMessage,
  onOpenThread,
  showThreadButton = true,
  isHighlighted = false,
  isGrouped = false,
  className
}) => {
  const {
    currentUser,
    users,
    activeConversationId,
    activeConversation,
    toggleReaction,
    togglePinMessage,
    editMessage,
    deleteMessage,
    retrySendMessage,
    dismissFailedMessage,
    setProfileModalUser,
    messages,
    setReplyingToMessage,
    setHighlightedMessageId
  } = useChat() as any;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const dateObj = new Date(message.timestamp);
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isDeleted = Boolean(
    message.isDeleted ||
    message.deletedAt ||
    (message as any).deleted_at ||
    message.content === 'This message was deleted' ||
    message.content === 'Message deleted by Admin'
  );

  const isDm = Boolean(
    message.conversationId?.startsWith('dm-') ||
    activeConversationId?.startsWith('dm-') ||
    (activeConversation as any)?.type === 'dm'
  );

  const peerId = isDm && message.conversationId?.startsWith('dm-')
    ? message.conversationId.replace('dm-', '').split('-').find((id: string) => id !== (currentUser?.id || '').replace('usr_', ''))
    : null;
  const peerUser = peerId ? users.find((u: any) => u.id === `usr_${peerId}` || String(u.id) === peerId) : null;
  const isPeerOnline = peerUser?.status === 'online' || peerUser?.status === 'busy';

  const canDelete = !isDeleted && (
    isOwnMessage ||
    (!isDm && currentUser?.role === 'main_admin')
  );
  const canEdit = !isDeleted && isOwnMessage;

  const repliedMessage = message.replyToId
    ? messages.find((m: any) => m.id === message.replyToId)
    : null;

  const handleSaveEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setShowActionMenu(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleBadgeLabel = React.useMemo(() => {
    if (sender?.role === 'main_admin') return 'CEO';
    if (sender?.title === 'Team Lead' || sender?.is_team_leader) return 'Lead';
    if (sender?.team && TEAMS_META[sender.team as TeamId]?.name) {
      return TEAMS_META[sender.team as TeamId].name;
    }
    return sender?.team || 'Member';
  }, [sender]);

  // Bubble style tokens depending on own vs other
  const bubbleBg = isOwnMessage ? 'var(--bubble-own-bg)' : 'var(--bubble-other-bg)';
  const bubbleText = isOwnMessage ? 'var(--bubble-own-text)' : 'var(--bubble-other-text)';
  const bubbleBorder = isOwnMessage ? 'var(--bubble-own-border)' : 'var(--bubble-other-border)';

  // User signature color profile
  const userPalette = getUserColorProfile(sender?.id, sender?.name);
  const userNameColor = getUserNameColor(sender?.id, sender?.name);

  return (
    <>
      <div
        id={`msg-${message.id}`}
        className={`group relative flex w-full px-3 transition-colors ${
          className !== undefined ? className : (isGrouped ? 'mt-1' : 'mt-3.5')
        } ${isHighlighted ? 'bg-surface-hover' : ''} ${
          isOwnMessage ? 'justify-end' : 'justify-start'
        }`}
      >
        {/* Hover Action Bar — cleanly anchored to message bubble */}
        {!isDeleted && (
          <div
            className={`absolute -top-3.5 hidden group-hover:flex items-center gap-0.5 rounded-md border border-subtle bg-surface p-0.5 shadow-md z-10 ${
              isOwnMessage ? 'right-3' : 'left-10'
            }`}
          >
            {/* Reaction */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  aria-label="Add reaction"
                >
                  <Smile className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">React</TooltipContent>
            </Tooltip>

            {/* Reply */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                  onClick={() => {
                    if (onOpenThread && showThreadButton) {
                      onOpenThread();
                    } else {
                      setReplyingToMessage(message);
                    }
                  }}
                  aria-label="Reply"
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Reply</TooltipContent>
            </Tooltip>

            {/* Pin */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 hover:bg-surface-hover cursor-pointer ${
                    message.isPinned ? 'text-primary' : 'text-secondary hover:text-primary'
                  }`}
                  onClick={() => togglePinMessage(message.id)}
                  aria-label={message.isPinned ? 'Unpin message' : 'Pin message'}
                >
                  <Pin className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{message.isPinned ? 'Unpin' : 'Pin'}</TooltipContent>
            </Tooltip>

            {/* More */}
            <div className="relative" ref={actionMenuRef}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => setShowActionMenu(!showActionMenu)}
                    aria-label="More options"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">More</TooltipContent>
              </Tooltip>

              {showActionMenu && (
                <div
                  className={`absolute top-7 w-36 rounded-md border border-subtle bg-surface p-1 shadow-md z-20 ${
                    isOwnMessage ? 'right-0' : 'left-0'
                  }`}
                >
                  <button
                    onClick={handleCopy}
                    className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs text-secondary hover:bg-surface-hover hover:text-primary transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Text'}</span>
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowActionMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs text-secondary hover:bg-surface-hover hover:text-primary transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowActionMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-xs text-danger hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emoji Quick Picker Popup — anchored directly above action toolbar */}
        {showEmojiPicker && (
          <div
            className={`absolute -top-11 flex items-center gap-1 rounded-md border border-subtle bg-surface p-1 shadow-md z-20 ${
              isOwnMessage ? 'right-3' : 'left-10'
            }`}
          >
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  toggleReaction(message.id, emoji);
                  setShowEmojiPicker(false);
                }}
                className="h-7 w-7 rounded hover:bg-surface-hover flex items-center justify-center text-sm transition-transform hover:scale-110 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Row: avatar (left only) + bubble */}
        <div className={`flex items-end gap-2 max-w-[72%] ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>

          {/* Avatar — strictly for other senders only; completely omitted for own messages */}
          {!isOwnMessage && (
            <div className="w-7 shrink-0 self-end mb-0.5">
              {isGrouped ? (
                <span className="block w-7" />
              ) : (
                <button
                  onClick={() => setProfileModalUser?.(sender)}
                  className="focus:outline-none cursor-pointer"
                  title={`View @${sender?.handle || sender?.name}`}
                >
                  <Avatar className="h-7 w-7 rounded-full text-xs font-semibold">
                    <AvatarImage src={sender?.avatarUrl || (sender as any)?.avatar} alt={sender?.name || 'User'} />
                    <AvatarFallback
                      className="rounded-full font-medium text-xs shadow-xs"
                      style={{ background: userPalette.bg, color: userPalette.text, border: `1px solid ${userPalette.border}` }}
                    >
                      {getInitials(sender?.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              )}
            </div>
          )}

          {/* Bubble */}
          <div className="flex flex-col min-w-0">
            {/* Pinned badge for own messages or grouped messages */}
            {(isOwnMessage || isGrouped) && message.isPinned && (
              <div className={`flex items-center gap-1 mb-1 px-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 leading-none">
                  <Pin className="h-2.5 w-2.5" />
                  <span>Pinned</span>
                </span>
              </div>
            )}

            {/* Sender name (only for others on un-grouped messages) */}
            {!isGrouped && !isOwnMessage && (
              <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                <button
                  onClick={() => setProfileModalUser?.(sender)}
                  className="text-xs font-semibold truncate hover:underline cursor-pointer"
                  style={{ color: userNameColor }}
                >
                  {sender?.name || 'Workspace Member'}
                </button>
                <Badge
                  variant="outline"
                  className="px-1 py-0 rounded text-xs font-medium bg-surface-hover text-secondary border border-subtle leading-tight"
                >
                  {roleBadgeLabel}
                </Badge>
                {message.isPinned && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 leading-none">
                    <Pin className="h-2.5 w-2.5" />
                    <span>Pinned</span>
                  </span>
                )}
              </div>
            )}

            {/* Bubble body — mature modern workspace card style */}
            <div
              className="rounded-xl px-3.5 py-2 min-w-0 shadow-2xs transition-shadow"
              style={{
                background: bubbleBg,
                color: bubbleText,
                border: `1px solid ${bubbleBorder}`,
                borderBottomRightRadius: isOwnMessage ? '3px' : '12px',
                borderBottomLeftRadius: isOwnMessage ? '12px' : '3px',
              }}
            >
              {/* Quoted reply snippet — nested inside bubble */}
              {repliedMessage && !isDeleted && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHighlightedMessageId?.(repliedMessage.id);
                  }}
                  className="flex items-center gap-1.5 text-xs mb-1.5 px-2.5 py-1 rounded-md max-w-full text-left cursor-pointer transition-opacity hover:opacity-90 w-full"
                  style={{
                    background: isOwnMessage ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                    borderLeft: `3px solid ${isOwnMessage ? 'var(--accent, #38bdf8)' : 'var(--border, #64748b)'}`,
                  }}
                  title="Click to jump to original message"
                >
                  <Reply className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="font-semibold text-[11px] shrink-0 opacity-90">
                    {repliedMessage.sender?.name || 'Colleague'}:
                  </span>
                  <span className="truncate text-[11px] opacity-80">
                    {repliedMessage.content || '[Attachment]'}
                  </span>
                </button>
              )}
              {isDeleted ? (
                <p className="text-xs italic opacity-60">
                  {message.content === 'Message deleted by Admin'
                    ? 'Message deleted by Admin'
                    : 'This message was deleted'}
                </p>
              ) : isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    onKeyDown={handleKeyDownEdit}
                    rows={2}
                    className="w-full rounded-md border border-subtle bg-surface p-2 text-sm text-primary placeholder:text-muted outline-none focus:border-focus resize-none font-sans"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-6 px-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-md cursor-pointer"
                      onClick={handleSaveEdit}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-secondary hover:text-primary hover:bg-surface-hover text-xs font-medium cursor-pointer"
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(message.content);
                      }}
                    >
                      Cancel
                    </Button>
                    <span className="text-xs opacity-60">Esc / Enter</span>
                  </div>
                </div>
              ) : (
                <div>
                  {message.content && (
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {message.content}
                      {message.editedAt && (
                        <span className="ml-1.5 text-xs opacity-50 italic">(edited)</span>
                      )}
                    </p>
                  )}

                  {/* Attachments — compact, max-w constrained */}
                  {(() => {
                    // Normalize: server may return attachments as JSON string, array, or null
                    let atts: Attachment[] = [];
                    try {
                      if (Array.isArray(message.attachments)) {
                        atts = message.attachments;
                      } else if (typeof message.attachments === 'string' && message.attachments) {
                        atts = JSON.parse(message.attachments);
                      }
                    } catch { atts = []; }
                    if (!atts.length) return null;
                    return (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {atts.map((att: Attachment) => {
                        const resolved = resolveMediaUrl(att.url);
                        const isImg = isImageAttachment(att);
                        const isVid = isVideoAttachment(att);
                        const isAud = isAudioAttachment(att);

                        if (isImg) {
                          return (
                            <div key={att.id} className="relative group/media overflow-hidden rounded-lg border border-subtle/30">
                              <img
                                src={resolved}
                                alt={att.name}
                                className="max-h-48 max-w-[280px] w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImage({ url: resolved, name: att.name })}
                              />
                              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    downloadAttachmentFile(att.downloadUrl || resolved, att.name);
                                  }}
                                  className="p-1 rounded bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
                                  title={`Download ${att.name || 'image'}`}
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLightboxImage({ url: resolved, name: att.name })}
                                  className="p-1 rounded bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
                                  title="Expand image"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (isVid) {
                          return (
                            <div key={att.id} className="rounded-lg overflow-hidden max-w-[280px]">
                              <video src={resolved} controls className="max-h-48 w-full rounded-lg" />
                            </div>
                          );
                        }

                        if (isAud) {
                          return (
                            <div key={att.id} className="flex items-center gap-2 rounded-lg border border-subtle/30 bg-black/10 p-1.5 max-w-[260px]">
                              <Music className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <audio src={resolved} controls className="h-7 flex-1" />
                            </div>
                          );
                        }

                        return (
                          <div
                            key={att.id}
                            onClick={() => downloadAttachmentFile(att.downloadUrl || resolved, att.name)}
                            className="flex items-center gap-2 rounded-lg border border-subtle/30 bg-black/10 px-2.5 py-1.5 hover:bg-black/20 transition-colors max-w-[260px] cursor-pointer group/att"
                            title={`Download ${att.name}`}
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 opacity-70 group-hover/att:opacity-100" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-medium truncate group-hover/att:underline">{att.name}</span>
                              <span className="text-xs opacity-60 font-mono">{formatBytes(att.size)}</span>
                            </div>
                            <Download className="h-3 w-3 shrink-0 opacity-60 group-hover/att:opacity-100" />
                          </div>
                        );
                      })}
                    </div>
                    );
                  })()}
                </div>
              )}

              {/* Footer row: time + status — cleanly docked inside bottom of bubble */}
              {!isDeleted && (
                <div className={`flex items-center gap-1.5 mt-1 pt-0.5 select-none ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10.5px] font-mono opacity-70 leading-none">{timeStr}</span>

                  {message.status === 'failed' && (
                    <span className="flex items-center gap-1 text-[11px] text-danger">
                      <AlertCircle className="h-3 w-3" />
                      Failed
                      <button
                        type="button"
                        onClick={() => retrySendMessage(message.id)}
                        className="underline cursor-pointer ml-0.5"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissFailedMessage(message.id)}
                        className="opacity-70 hover:opacity-100 cursor-pointer ml-0.5"
                      >
                        Dismiss
                      </button>
                    </span>
                  )}

                  {message.status === 'sending' && (
                    <span className="h-2 w-2 rounded-full border border-current border-t-transparent animate-spin inline-block opacity-70" title="Sending..." />
                  )}

                  {isOwnMessage && isDm && message.status !== 'sending' && message.status !== 'failed' && (
                    message.readAt ? (
                      <span
                        tabIndex={0}
                        className="seen-pill"
                        title={`Seen at ${new Date(message.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      >
                        <span className="font-semibold tracking-tighter text-sky-400">✓✓</span>
                        <span className="seen-label">Seen</span>
                        <span className="seen-time">
                          {new Date(message.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    ) : isPeerOnline ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium opacity-75 px-1 py-0.2 rounded cursor-default select-none"
                        title="Delivered (not opened yet)"
                      >
                        <span className="font-semibold tracking-tighter">✓✓</span>
                        <span>Delivered</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium opacity-75 px-1 py-0.2 rounded cursor-default select-none"
                        title="Sent (waiting for recipient)"
                      >
                        <span className="font-semibold">✓</span>
                        <span>Sent</span>
                      </span>
                    )
                  )}

                  {isOwnMessage && !isDm && message.status === 'sent' && (
                    <span className="text-[11px] font-semibold select-none px-0.5 opacity-75" title="Sent to channel">
                      ✓
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Reactions Bar */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className={`mt-1 flex flex-wrap items-center gap-1 px-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                {Object.entries(message.reactions).map(([emoji, userIds]: [string, any]) => {
                  const count = Array.isArray(userIds) ? userIds.length : 0;
                  if (count === 0) return null;
                  const hasReacted = Array.isArray(userIds) && currentUser && userIds.includes(currentUser.id);

                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => toggleReaction(message.id, emoji)}
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition-colors border cursor-pointer ${
                        hasReacted
                          ? 'bg-accent-muted border-accent text-accent'
                          : 'bg-surface border-subtle text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className="font-medium text-xs">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl"
            />
            {/* Action Bar with Download & Close */}
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadAttachmentFile(lightboxImage.url, lightboxImage.name)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs font-medium backdrop-blur-xs transition-colors cursor-pointer border border-white/20 shadow-lg"
                title={`Download ${lightboxImage.name || 'image'}`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
              <button
                onClick={() => setLightboxImage(null)}
                className="rounded-lg bg-black/70 hover:bg-black/90 text-white p-1.5 border border-white/20 shadow-lg cursor-pointer transition-colors backdrop-blur-xs"
                title="Close (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Message"
          description="Are you sure you want to delete this message? This action will mark it as deleted."
          confirmLabel="Delete"
          isDestructive={true}
          onConfirm={() => {
            deleteMessage(message.id);
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
};
