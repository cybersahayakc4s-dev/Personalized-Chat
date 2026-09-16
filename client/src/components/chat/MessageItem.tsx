import React, { useState, useRef } from 'react';
import { Message, User, Attachment, TeamId } from '../../types';
import { useChat } from '../../context/ChatContext';
import { TEAMS_META } from '../../data/initialData';
import { Avatar } from '../common/Avatar';
import { TeamBadge, RoleBadge } from '../common/Badge';
import { MessageBubble } from './MessageBubble';
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
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  Eye,
  Film,
  Music,
  Maximize2,
  X
} from 'lucide-react';
import { applySmartFormatting, handleSmartEnter, handleFormattingShortcuts, FormatType } from '../../utils/textFormatting';
import { getUserColor } from '../../utils/userColors';
import { getServerBaseUrl } from '../../services/api';

interface MessageItemProps {
  message: Message;
  sender: User;
  isOwnMessage: boolean;
  onOpenThread?: () => void;
  showThreadButton?: boolean;
  isHighlighted?: boolean;
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

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  sender,
  isOwnMessage,
  onOpenThread,
  showThreadButton = true,
  isHighlighted = false
}) => {
  const {
    currentUser,
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
    setHighlightedMessageId,
    addToast,
    theme
  } = useChat() as any;

  const isDark = theme !== 'nordic';

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Formatted date / time in IBM Plex Mono
  const dateObj = new Date(message.timestamp);
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Check if message is soft-deleted
  const isDeleted = Boolean(
    message.isDeleted ||
    message.deletedAt ||
    (message as any).deleted_at ||
    message.content === 'This message was deleted' ||
    message.content === 'Message deleted by Admin'
  );

  // Check if message belongs to a 1:1 direct message conversation
  const isDm = Boolean(
    message.conversationId?.startsWith('dm-') ||
    activeConversationId?.startsWith('dm-') ||
    (activeConversation as any)?.type === 'dm'
  );

  // Can delete: own message always (unless deleted).
  // Main-Admin can only delete channel / team messages (zero-backdoor DM rule: never another user's DM).
  const canDelete = !isDeleted && (
    isOwnMessage ||
    (!isDm && currentUser?.role === 'main_admin')
  );
  const canEdit = !isDeleted && isOwnMessage;

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  // Resolve replied-to message if any
  const repliedMessage = message.replyToId
    ? messages.find(m => m.id === message.replyToId)
    : null;

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      editMessage(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const applyEditFormatting = (formatType: FormatType) => {
    if (!editTextareaRef.current) return;
    applySmartFormatting(editTextareaRef.current, editContent, setEditContent, formatType);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Shortcuts: Ctrl/Cmd + B, I, Shift+X, E
    if (editTextareaRef.current && handleFormattingShortcuts(e, editTextareaRef.current, editContent, setEditContent)) {
      return;
    }

    // 2. Escape cancels edit
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditContent(message.content);
      setIsEditing(false);
      return;
    }

    // 3. Ctrl+Enter or Cmd+Enter saves edit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
      return;
    }

    // 4. Enter key on list item or quote auto-continues
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.repeat || e.nativeEvent.isComposing) {
        e.preventDefault();
        return;
      }
      if (editTextareaRef.current && handleSmartEnter(e, editTextareaRef.current, editContent, setEditContent)) {
        return;
      }
    }
  };

  const senderColor = getUserColor(sender.id, sender.name);
  const hasText = Boolean(message.content && message.content.trim().length > 0);

  const renderStatus = () => (
    <div className={`flex items-center gap-1.5 text-[10px] font-mono select-none ${
      isOwnMessage ? 'justify-end text-slate-400/90' : 'justify-start text-slate-400/90'
    }`}>
      {message.editedAt && (
        <span className="italic text-[9px] text-slate-400/75">(edited)</span>
      )}

      {message.status === 'failed' ? (
        <span className="inline-flex items-center gap-1.5 text-rose-400 font-mono text-[10px]">
          <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
          <span>Failed to send{message.sendError ? `: ${message.sendError}` : ''}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              retrySendMessage(message.id);
            }}
            className="ml-1 px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold cursor-pointer underline transition-colors"
            title={message.sendError || "Retry sending"}
          >
            Retry
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissFailedMessage(message.id);
            }}
            className="ml-1 px-1.5 py-0.5 rounded bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 font-semibold cursor-pointer transition-colors"
            title="Dismiss failed message"
          >
            Dismiss
          </button>
        </span>
      ) : message.status === 'sending' ? (
        <span className="inline-flex items-center gap-1 text-slate-400/80 font-mono text-[10px] italic">
          <span className="w-2 h-2 rounded-full border border-slate-400 border-t-transparent animate-spin inline-block" />
          <span>Sending...</span>
        </span>
      ) : isOwnMessage && message.conversationId?.startsWith('dm-') ? (
        message.readAt ? (
          <span className="inline-flex items-center gap-1 text-slate-400 font-mono" title={`Sent: ${timeStr} • Seen: ${new Date(message.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
            <span>Sent {timeStr}</span>
            <span className="opacity-60">•</span>
            <span className="text-blue-400 font-medium">Seen {new Date(message.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-blue-400 font-bold tracking-[-2px] ml-0.5">✓✓</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400 font-mono" title={`Sent: ${timeStr} • Delivered`}>
            <span>Sent {timeStr}</span>
            <span className="opacity-60">•</span>
            <span className="text-slate-400">Delivered</span>
            <span className="text-slate-400 font-bold ml-0.5">✓</span>
          </span>
        )
      ) : (
        <span>{timeStr}</span>
      )}
    </div>
  );

  const isUpdatesChannel = message.format === 'channel:updates' ||
    activeConversationId === 'c-updates' ||
    (activeConversation as any)?.id === 'c-updates' ||
    (activeConversation as any)?.name === 'updates';
  const senderTeamName = (sender.team && TEAMS_META[sender.team as TeamId]?.name) ||
    sender.team ||
    (sender.role === 'main_admin' ? 'Main Admin' : 'Workspace Member');

  return (
    <div
      id={`msg-${message.id}`}
      className={`group/row relative flex items-start gap-2.5 px-4 py-1.5 transition-colors ${
        isOwnMessage ? 'justify-end' : 'justify-start'
      } ${
        isHighlighted
          ? 'bg-amber-500/15 border-l-4 border-amber-500 shadow-xs'
          : message.isPinned
          ? 'bg-amber-500/10 border-l-2 border-amber-500'
          : 'hover:bg-white/[0.02]'
      }`}
    >
      {/* Sender Avatar: ONLY for incoming messages */}
      {!isOwnMessage && (
        <button
          onClick={() => setProfileModalUser(sender)}
          className="self-start mt-0.5 focus:outline-hidden flex-shrink-0 cursor-pointer"
          title={`View @${sender.handle}`}
        >
          <Avatar user={sender} size="sm" showStatus={true} />
        </button>
      )}

      {/* WhatsApp-style side hover buttons for own messages: placed to the LEFT of the bubble */}
      {isOwnMessage && !isDeleted && (
        <div className="self-center hidden sm:flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity mr-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="React"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setReplyingToMessage(message)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Content Container — position:relative so the action toolbar can be absolute inside it */}
      <div className={`relative flex flex-col min-w-0 max-w-[88%] sm:max-w-[74%] ${
        isOwnMessage ? 'items-end' : 'items-start'
      }`}>
        {/* Header: In #updates channel show sender + team badge; otherwise show on incoming */}
        {isUpdatesChannel ? (
          <div className={`flex items-center gap-1.5 mb-1 select-none ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            <button
              onClick={() => setProfileModalUser(sender)}
              style={{ color: senderColor }}
              className="font-semibold text-xs hover:underline cursor-pointer"
            >
              {sender.name}
            </button>
            <span className="text-slate-400 font-mono text-[10px]">•</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {senderTeamName}
            </span>
            {message.isPinned && (
              <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                <Pin className="w-2.5 h-2.5 text-amber-400" />
                Pinned
              </span>
            )}
          </div>
        ) : !isOwnMessage ? (
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => setProfileModalUser(sender)}
              style={{ color: senderColor }}
              className="font-semibold text-xs hover:underline cursor-pointer"
            >
              {sender.name}
            </button>

            {message.metadata?.tag && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                {message.metadata.tag}
              </span>
            )}

            {message.isPinned && (
              <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                <Pin className="w-2.5 h-2.5 text-amber-400" />
                Pinned
              </span>
            )}
          </div>
        ) : null}

        {/* Replying Context quote if present — Clicking jumps to original message */}
        {repliedMessage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHighlightedMessageId(repliedMessage.id);
            }}
            className={`mb-1.5 pl-2.5 border-l-3 text-xs flex items-center gap-1.5 truncate py-1.5 px-2.5 rounded-r-md max-w-full text-left cursor-pointer transition-all hover:opacity-85 ${
              isDark
                ? 'border-blue-400 bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                : 'border-blue-500 bg-blue-50/70 text-slate-700 hover:bg-blue-100/70'
            }`}
            title="Click to jump to original message"
          >
            <Reply className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="text-blue-400 font-semibold text-[11px]">
              {messages.find((m: Message) => m.id === repliedMessage.id)?.senderId === currentUser.id ? 'You' : 'Replying to'}:
            </span>
            <span className="italic truncate text-[11.5px] opacity-90">{repliedMessage.content || '[Attachment]'}</span>
          </button>
        )}

        {/* Message Body or Edit Mode */}
        {isEditing ? (
          <div className="mt-1 space-y-2 w-full">
            <div className={`flex flex-wrap items-center gap-1 px-2.5 py-1.5 rounded-t-lg border border-b-0 text-xs transition-colors ${
              isDark ? 'bg-[#182030] border-[#2E3C52] text-slate-300' : 'bg-[#E8EEF5] border-[#C6D0DC] text-slate-700'
            }`}>
              <button
                type="button"
                onClick={() => applyEditFormatting('bold')}
                className={`p-1 rounded font-bold transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Bold (Ctrl+B or **text**)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('italic')}
                className={`p-1 rounded italic transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Italic (Ctrl+I or *text*)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('strikethrough')}
                className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Strikethrough (Ctrl+Shift+X or ~~text~~)"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('code')}
                className={`p-1 rounded font-mono text-xs transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Inline Code (`code`)"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('link')}
                className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Hyperlink ([label](url))"
              >
                <Link className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('bullet')}
                className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Bullet List (- item)"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('ordered')}
                className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Numbered List (1. item)"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyEditFormatting('quote')}
                className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'}`}
                title="Quote Block (> item)"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>

              <span className={`text-[10px] font-mono ml-auto hidden sm:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ctrl+Enter to save • Esc to cancel
              </span>
            </div>
            <textarea
              ref={editTextareaRef}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className={`w-full p-2.5 rounded-b-lg border text-[13.5px] leading-[22px] focus:outline-hidden resize-none font-body transition-colors shadow-xs ${
                isDark
                  ? 'bg-[#121620] border-[#2E3C52] text-slate-100 focus:border-blue-500'
                  : 'bg-white border-[#C6D0DC] text-slate-900 focus:border-blue-600'
              }`}
              rows={3}
            />
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={handleSaveEdit}
                className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditContent(message.content);
                  setIsEditing(false);
                }}
                className={`h-8 px-3.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isDeleted ? (
          <div className="flex items-center gap-1.5 py-1 text-xs italic text-slate-400 select-none font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>This message was deleted</span>
          </div>
        ) : hasText ? (
          <div
            className={`break-words px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed shadow-xs max-w-full ${
              isOwnMessage
                ? isDark
                  ? 'bg-[#1E2738] border border-[#2E3C54] text-slate-100 rounded-tr-xs border-r-2'
                  : 'bg-[#EFF6FF] border border-[#BFDBFE] text-slate-900 rounded-tr-xs border-r-2'
                : isDark
                ? 'bg-[#141B28] border border-[#1E293B] text-[#E2E8F0] rounded-tl-xs'
                : 'bg-white border border-[#CBD5E1] text-[#1E293B] rounded-tl-xs'
            }`}
            style={isOwnMessage
              ? { borderRightColor: senderColor, borderRightWidth: '3px' }
              : { borderLeftColor: senderColor, borderLeftWidth: '3px', borderRadius: '0 1rem 1rem 1rem' }
            }
          >
            <MessageBubble
              content={message.content}
              format={message.format}
              formatting={message.formatting}
            />

            {/* Executive Status & Timestamp Bar */}
            <div className="mt-1">
              {renderStatus()}
            </div>
          </div>
        ) : null}

        {/* Rich Attachment Card from Picture 3 */}
        {message.metadata?.cardType === 'attachment' && (
          <div className="mt-2.5 max-w-2xl rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 shadow-2xs hover:bg-slate-50 transition">
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                    <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
                    <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
                    <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
                    <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 truncate">
                      {message.metadata.fileName}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {message.metadata.status || 'Validated'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {message.metadata.fileSize} • Prepared by {message.metadata.preparedBy} • RunID: <span className="text-blue-600">{message.metadata.runId}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                <button
                  onClick={() => addToast?.({ type: 'info', title: 'Metrics Inspected', description: 'Validation score: 87.4% on MMLU benchmarks' })}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Inspect Metrics</span>
                </button>
                <button
                  onClick={() => addToast?.({ type: 'success', title: 'Download Started', description: 'Secure validation artifacts package requested.' })}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span className="text-emerald-700 font-medium">
                ✓ {message.metadata.benchmark}
              </span>
              <span className="text-slate-400">
                {message.metadata.legalClearance}
              </span>
            </div>
          </div>
        )}

        {/* Rich Telemetry Terminal Card from Picture 3 */}
        {message.metadata?.cardType === 'telemetry' && (
          <div className="mt-2.5 max-w-2xl rounded-lg bg-[#0d131f] text-slate-200 p-3.5 font-mono text-xs border border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/80 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300 font-semibold">{message.metadata.title}</span>
              </div>
              <span className="text-slate-500">{message.metadata.node}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-400">throughput: </span>
                <span className="text-emerald-400 font-bold">142 tok/sec</span>
                <span className="text-slate-400"> (concurrency=32, p99=42ms)</span>
              </div>
              <button
                onClick={handleCopy}
                className="p-1 rounded text-slate-400 hover:text-white transition"
                title="Copy telemetry"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Rich Media & Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className={`mt-2 flex flex-col gap-2 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
            {message.attachments.map(att => {
              if (isImageAttachment(att)) {
                return (
                  <div
                    key={att.id}
                    className={`relative group w-fit max-w-[320px] sm:max-w-[360px] rounded-xl overflow-hidden border transition shadow-sm ${
                      isDark
                        ? 'border-slate-700/60 bg-slate-900/30 hover:border-blue-500/50'
                        : 'border-slate-200 bg-slate-100/50 hover:border-blue-400'
                    }`}
                  >
                    <img
                      src={resolveMediaUrl(att.url)}
                      alt={att.name}
                      loading="lazy"
                      onClick={() => setLightboxImage({ url: resolveMediaUrl(att.url), name: att.name })}
                      className="block max-h-[200px] sm:max-h-[230px] w-auto max-w-[320px] sm:max-w-[360px] object-contain cursor-zoom-in transition-transform duration-200 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 flex items-end justify-between gap-2 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100 pointer-events-none">
                      <span className="text-white text-[11px] font-mono truncate max-w-[180px]" title={att.name}>
                        {att.name} ({formatBytes(att.size)})
                      </span>
                      <div className="flex items-center gap-1 pointer-events-auto flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setLightboxImage({ url: resolveMediaUrl(att.url), name: att.name })}
                          className="p-1 rounded-md bg-black/70 hover:bg-black text-white transition cursor-pointer"
                          title="Enlarge preview"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={resolveMediaUrl(att.downloadUrl || att.url)}
                          download={att.name}
                          className="p-1 rounded-md bg-black/70 hover:bg-black text-white transition cursor-pointer"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isVideoAttachment(att)) {
                return (
                  <div
                    key={att.id}
                    className={`w-fit max-w-[320px] sm:max-w-[360px] rounded-xl overflow-hidden border shadow-sm flex flex-col ${
                      isDark
                        ? 'border-slate-700/60 bg-black'
                        : 'border-slate-200 bg-black'
                    }`}
                  >
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      className="block max-h-[200px] sm:max-h-[230px] max-w-[320px] sm:max-w-[360px] w-auto object-contain bg-black"
                    >
                      <source src={resolveMediaUrl(att.url)} type={att.type || 'video/mp4'} />
                      Your browser does not support HTML5 video streaming.
                    </video>
                    <div className={`flex items-center justify-between gap-3 px-3 py-1.5 text-xs border-t ${
                      isDark ? 'bg-[#0F172A] border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Film className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        <span className="truncate font-mono text-[11px] font-medium max-w-[170px]" title={att.name}>{att.name}</span>
                      </div>
                      <a
                        href={resolveMediaUrl(att.downloadUrl || att.url)}
                        download={att.name}
                        className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 font-mono text-[11px] transition ml-2 flex-shrink-0"
                        title="Download video"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{formatBytes(att.size)}</span>
                      </a>
                    </div>
                  </div>
                );
              }

              if (isAudioAttachment(att)) {
                return (
                  <div
                    key={att.id}
                    className={`w-full max-w-[320px] sm:max-w-[360px] rounded-xl p-2.5 border shadow-xs flex flex-col gap-1.5 ${
                      isDark ? 'bg-[#162032] border-slate-700/50' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs font-mono font-medium truncate">{att.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-auto">{formatBytes(att.size)}</span>
                    </div>
                    <audio controls src={resolveMediaUrl(att.url)} className="w-full h-8 mt-1" />
                  </div>
                );
              }

              return (
                <div
                  key={att.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition shadow-xs w-fit max-w-[320px] sm:max-w-[360px] ${
                    isDark
                      ? 'bg-[#182030] border-[#2E3C52] hover:bg-[#1E293B] text-slate-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs truncate max-w-[180px]" title={att.name}>{att.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatBytes(att.size)}</p>
                  </div>
                  <a
                    href={resolveMediaUrl(att.downloadUrl || att.url)}
                    download={att.name}
                    className={`p-1.5 rounded-md transition flex-shrink-0 ${
                      isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                  </a>
                </div>
              );
            })}

            {/* If there was no text bubble, show the timestamp / status directly under the attachments */}
            {!hasText && (
              <div className="mt-0.5 px-0.5">
                {renderStatus()}
              </div>
            )}
          </div>
        )}

        {/* If no text and no attachments, render status here (e.g. metadata cards or empty) */}
        {!hasText && (!message.attachments || message.attachments.length === 0) && (
          <div className="mt-0.5 px-0.5">
            {renderStatus()}
          </div>
        )}

        {/* Reactions Section */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1.5 items-center w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([emoji, userIdsRaw]) => {
              const userIds = (Array.isArray(userIdsRaw) ? userIdsRaw : []) as (string | number)[];
              const currentNum = Number(String(currentUser.id || '').replace(/^usr_/, ''));
              const hasReacted = userIds.some(id => {
                const idStr = String(id);
                if (idStr === String(currentUser.id)) return true;
                const idNum = Number(idStr.replace(/^usr_/, ''));
                return !isNaN(idNum) && !isNaN(currentNum) && idNum === currentNum;
              });
              const count = userIds.length;
              if (count === 0) return null;

              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(message.id, emoji)}
                  className={`h-6 px-2 rounded-[4px] text-xs font-mono inline-flex items-center gap-1.5 transition-all ${
                    hasReacted
                      ? isDark
                        ? 'bg-blue-950/70 border border-blue-500/60 text-blue-300 font-medium shadow-xs'
                        : 'bg-blue-50 border border-blue-400 text-blue-700 font-medium shadow-xs'
                      : isDark
                      ? 'bg-[#151D2C] border border-[#273549] text-slate-300 hover:bg-[#1E293B] hover:text-white'
                      : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                >
                  <span className="text-[12px]">{emoji}</span>
                  <span className="text-[11px] font-mono">{count}</span>
                </button>
              );
            })}

            {/* Quick Add Reaction Button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`h-6 w-6 rounded-[4px] flex items-center justify-center transition-colors ${
                isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Add reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Inline Emoji Quick Picker */}
        {showEmojiPicker && (
          <div className={`mt-1.5 flex items-center gap-1 p-1 rounded-[6px] border shadow-lg w-max animate-in fade-in duration-100 z-10 ${
            isDark
              ? 'bg-[#151D2C] border-[#273549] text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
              : 'bg-white border-slate-200 text-slate-700 shadow-[0_6px_18px_rgba(0,0,0,0.12)]'
          }`}>
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => {
                  toggleReaction(message.id, emoji);
                  setShowEmojiPicker(false);
                }}
                className="p-1 text-sm hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {/* Floating Action Menu — fixed intrinsic width, no underflow clipping */}
        {!isDeleted && (
          <div className={`absolute ${isOwnMessage ? '-top-3.5 right-0' : '-top-3.5 left-0'} w-max overflow-visible hidden group-hover/row:flex items-center gap-0.5 p-0.5 sm:p-1 rounded-lg border z-30 shadow-lg ${
            isDark ? 'bg-[#182030] border-[#263348] text-slate-300' : 'bg-[#EAEFF5] border-[#C6D0DC] text-slate-700 shadow-md'
          }`}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 rounded text-xs transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-slate-600 hover:text-slate-900 hover:bg-[#DEE5EE]'}`}
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setReplyingToMessage(message)}
              className={`p-1.5 rounded text-xs transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-slate-600 hover:text-slate-900 hover:bg-[#DEE5EE]'}`}
              title="Reply to message"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => togglePinMessage(message.id)}
              className={`p-1.5 rounded text-xs transition cursor-pointer ${
                message.isPinned
                  ? 'text-amber-400 bg-amber-500/20'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={message.isPinned ? 'Unpin message' : 'Pin message'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleCopy}
              className={`p-1.5 rounded text-xs transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              title="Copy text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className={`p-1.5 rounded text-xs transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Edit message"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {canDelete && (
              <button
                onClick={handleDelete}
                className={`p-1.5 rounded text-xs transition cursor-pointer ${isDark ? 'text-rose-400 hover:bg-rose-500/20' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'}`}
                title="Delete message"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* WhatsApp-style side hover buttons for incoming messages: placed to the RIGHT of the bubble */}
      {!isOwnMessage && !isDeleted && (
        <div className="self-center hidden sm:flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity ml-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="React"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setReplyingToMessage(message)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
        </div>
      )}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] flex flex-col items-center bg-[#0B0F17] rounded-2xl border border-slate-700/60 p-3 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 px-2 text-white border-b border-slate-800 mb-3">
              <span className="font-mono text-xs text-slate-300 truncate max-w-md">{lightboxImage.name}</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.url}
                  download={lightboxImage.name}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 text-xs font-mono"
                  title="Download image"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Accessible Non-Blocking Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Message"
        description="Are you sure you want to delete this message? This action will remove its contents for all users."
        confirmLabel="Delete Message"
        cancelLabel="Keep Message"
        isDestructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteMessage(message.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
