import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { Attachment, User } from '../../types';
import { Avatar } from '../common/Avatar';
import { getUserColor } from '../../utils/userColors';
import {
  Send,
  Paperclip,
  Smile,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  X,
  FileText,
  RefreshCw,
  AtSign,
  FileCode,
  Lock,
  Megaphone,
  Film,
  UserX,
  Reply,
  Image as ImageIcon
} from 'lucide-react';
import { applySmartFormatting, handleSmartEnter, handleFormattingShortcuts, FormatType } from '../../utils/textFormatting';

interface MessageInputProps {
  placeholder?: string;
  replyToId?: string;
}

const EMOJIS = ['👍', '❤️', '🔥', '🚀', '🔒', '💡', '👀', '🎉', '👋', '🎯', '⚡', '✨'];

export const MessageInput: React.FC<MessageInputProps> = ({ placeholder, replyToId }) => {
  const {
    activeConversationId,
    activeConversation,
    isDm,
    currentUser,
    users = [],
    sendMessage,
    replyingToMessage,
    setReplyingToMessage,
    theme
  } = useChat() as any;

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // @ Mention state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  const isSubmittingRef = useRef<boolean>(false);

  const isDark = theme !== 'nordic';

  // Clipboard paste support for screenshots / images
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const files = Array.from(e.clipboardData.files);
      const newAtts = files.map((f, i) => ({
        id: `att-${Date.now()}-${i}`,
        name: f.name || `image-${Date.now()}.png`,
        size: f.size,
        type: f.type || 'image/png',
        url: URL.createObjectURL(f),
        rawFile: f
      }));
      setAttachments(prev => [...prev, ...newAtts]);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  // Channel & Recipient RBAC Posting Restrictions
  const otherUser = isDm ? (activeConversation as any)?.otherUser : null;
  const isDeletedRecipient = isDm && Boolean(
    otherUser?.account_status === 'deleted' ||
    otherUser?.status === 'deleted' ||
    otherUser?.name === '[Deleted User]' ||
    otherUser?.handle?.startsWith('deleted_') ||
    (otherUser?.email && otherUser.email.includes('@archived.internal'))
  );
  const isDisabledRecipient = isDm && Boolean(
    !isDeletedRecipient && (
      otherUser?.account_status === 'disabled' ||
      otherUser?.status === 'disabled' ||
      otherUser?.isActive === false
    )
  );

  const isAnnouncement = activeConversationId === 'c-announcements';
  const isUpdates = activeConversationId === 'c-updates';

  let canPost = true;
  let restrictionMessage = '';

  if (isDeletedRecipient) {
    canPost = false;
    restrictionMessage = 'This user account has been deleted. You cannot send new messages to a deleted account.';
  } else if (isDisabledRecipient) {
    canPost = false;
    restrictionMessage = 'This colleague account is currently deactivated. You cannot send messages to this user.';
  } else if (isAnnouncement && currentUser?.role !== 'main_admin') {
    canPost = false;
    restrictionMessage = 'Only Main-Admin (CEO) has posting authorization in #announcements. You are in read-only mode.';
  } else if (isUpdates) {
    const isLeadOrAdmin = currentUser?.role === 'main_admin' || Boolean(currentUser?.is_team_leader) || (currentUser?.title && currentUser.title.toLowerCase().includes('lead'));
    if (!isLeadOrAdmin) {
      canPost = false;
      restrictionMessage = 'Only Team Leaders and Main-Admin can post updates in #updates. You are in read-only mode.';
    }
  }

  // Intelligent Word-Aware Formatting (Bold, Italic, Strikethrough, Code, Lists, Quotes)
  const applyFormatting = (formatType: FormatType) => {
    if (!textareaRef.current) return;
    applySmartFormatting(textareaRef.current, text, setText, formatType);
  };

  const replySender = React.useMemo(() => {
    if (!replyingToMessage) return null;
    return users.find((u: User) => u.id === replyingToMessage.senderId) || null;
  }, [replyingToMessage, users]);

  useEffect(() => {
    if (replyingToMessage && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingToMessage]);

  const handleSend = () => {
    if (isSubmittingRef.current || !canPost) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    isSubmittingRef.current = true;
    const contentToSend = text;
    const attachmentsToSend = [...attachments];
    const replyToSend = replyToId || replyingToMessage?.id;

    setText('');
    setAttachments([]);
    setShowEmojiPicker(false);
    setReplyingToMessage?.(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      sendMessage(contentToSend, attachmentsToSend, replyToSend);
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 350);
    }
  };

  // Eligible members to mention in current conversation
  const eligibleUsers: User[] = React.useMemo(() => {
    if (isDm) return [];
    const teamChan = (activeConversation as any)?.team;
    let pool = users.filter((u: User) => u.id !== currentUser.id);
    if (teamChan) {
      const teamPool = pool.filter((u: User) => u.team === teamChan || u.role === 'main_admin');
      if (teamPool.length > 0) pool = teamPool;
    }
    if (!mentionQuery) return pool;
    const q = mentionQuery.toLowerCase();
    return pool.filter(
      (u: User) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.handle && u.handle.toLowerCase().includes(q))
    );
  }, [users, currentUser.id, isDm, activeConversation, mentionQuery]);

  // Track text changes and detect '@'
  const handleTextChange = (val: string) => {
    setText(val);
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      // Must be at start or preceded by whitespace
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : ' ';
      const queryAfterAt = textBeforeCursor.slice(lastAtIdx + 1);

      if (/\s/.test(charBeforeAt) && !/\s/.test(queryAfterAt)) {
        setMentionQuery(queryAfterAt);
        setShowMentionMenu(true);
        setMentionIndex(0);
        return;
      }
    }

    setShowMentionMenu(false);
  };

  // Insert selected mention
  const handleSelectMention = (user: User) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || text.length;
    const textBeforeCursor = text.slice(0, cursorPos);
    const textAfterCursor = text.slice(cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const prefix = textBeforeCursor.slice(0, lastAtIdx);
      const mentionText = `@${user.handle} `;
      const nextText = `${prefix}${mentionText}${textAfterCursor}`;
      setText(nextText);
      setShowMentionMenu(false);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = prefix.length + mentionText.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 0. Handle mention dropdown navigation
    if (showMentionMenu && eligibleUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % eligibleUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + eligibleUsers.length) % eligibleUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = eligibleUsers[mentionIndex] || eligibleUsers[0];
        if (chosen) {
          handleSelectMention(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    // 1. Formatting keyboard shortcuts: Ctrl/Cmd + B, I, Shift+X, E
    if (textareaRef.current && handleFormattingShortcuts(e, textareaRef.current, text, setText)) {
      return;
    }

    // Escape cancels active reply
    if (e.key === 'Escape' && replyingToMessage) {
      e.preventDefault();
      setReplyingToMessage?.(null);
      return;
    }

    // 2. Enter key handling: lists/quotes auto-continue vs send message
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.repeat || e.nativeEvent.isComposing) {
        e.preventDefault();
        return;
      }
      // Check if current line is a bullet/numbered list or quote that should continue or cleanly exit
      if (textareaRef.current && handleSmartEnter(e, textareaRef.current, text, setText)) {
        return;
      }
      e.preventDefault();
      handleSend();
      return;
    }
  };

  // If user cannot post due to channel RBAC restriction or deleted recipient
  if (!canPost) {
    return (
      <div className={`p-4 border-t transition-colors ${
        isDark ? 'border-[#222C3E] bg-[#121620]' : 'border-slate-300 bg-slate-100'
      }`}>
        <div className={`flex items-center gap-3 p-3.5 rounded-xl text-xs font-medium border shadow-xs ${
          isDeletedRecipient
            ? isDark
              ? 'bg-rose-950/40 border-rose-800/50 text-rose-200'
              : 'bg-rose-50 border-rose-200 text-rose-800'
            : isDisabledRecipient
            ? isDark
              ? 'bg-amber-950/40 border-amber-800/50 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-800'
            : isAnnouncement
            ? isDark
              ? 'bg-amber-950/40 border-amber-800/50 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-800'
            : isDark
            ? 'bg-blue-950/40 border-blue-800/50 text-blue-200'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isDeletedRecipient
              ? isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-200 text-rose-700'
              : isDisabledRecipient || isAnnouncement
              ? isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-200 text-amber-700'
              : isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-200 text-blue-700'
          }`}>
            {isDeletedRecipient || isDisabledRecipient ? (
              <UserX className="w-4 h-4" />
            ) : isAnnouncement ? (
              <Megaphone className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </div>
          <div className="leading-relaxed">
            <span className="font-bold tracking-tight">
              {isDeletedRecipient
                ? 'Account Deleted: '
                : isDisabledRecipient
                ? 'Account Deactivated: '
                : 'Channel Access Restricted: '}
            </span>
            <span>{restrictionMessage}</span>
          </div>
        </div>
      </div>
    );
  }

  const recipientName = isDm
    ? (activeConversation as any)?.otherUser?.name || 'Team Colleague'
    : (activeConversation as any)?.name || 'AI Team';

  const defaultPlaceholder = `Message ${isDm ? recipientName : '#' + recipientName} or type / to link task, doc, or PR...`;

  return (
    <div className={`p-4 ${isDark ? 'bg-[#121620] border-t border-[#222C3E]' : 'bg-[#D8DFE7] border-t border-[#C6D0DC]'} transition-colors`}>
      {/* File input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files) {
            const files = Array.from(e.target.files);
            const newAtts = files.map((f, i) => ({
              id: `att-${Date.now()}-${i}`,
              name: f.name,
              size: f.size,
              type: f.type,
              url: URL.createObjectURL(f),
              rawFile: f
            }));
            setAttachments(prev => [...prev, ...newAtts]);
          }
        }}
      />

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2.5">
          {attachments.map(att => {
            const isImg = att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name);
            const isVid = att.type?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(att.name);
            return (
              <div
                key={att.id}
                className={`relative group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs border transition shadow-xs ${
                  isDark ? 'bg-[#182030] border-[#2E3C52] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                {isImg ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-10 h-10 object-cover rounded-md border border-slate-600/30 flex-shrink-0"
                  />
                ) : isVid ? (
                  <div className="w-10 h-10 rounded-md bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                    <Film className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0 max-w-[140px]">
                  <p className={`truncate font-mono text-[11px] font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{att.name}</p>
                  <p className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{(att.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                  className={`ml-1 p-1 rounded transition ${isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-500 hover:text-rose-600'}`}
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Quoted Reply Banner */}
      {replyingToMessage && (
        <div className={`mb-2 px-3.5 py-2 rounded-xl border-l-4 border-blue-500 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-150 ${
          isDark
            ? 'bg-[#151D2C] border border-[#273549] border-l-blue-500 text-slate-200'
            : 'bg-blue-50/90 border border-blue-200 border-l-blue-600 text-slate-800'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Reply className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-blue-500 mr-2">
                Replying to {replySender?.name || 'Message'}:
              </span>
              <span className="italic truncate text-[11.5px] opacity-85 inline-block max-w-[280px] sm:max-w-[480px] align-bottom">
                {replyingToMessage.content || (replyingToMessage.attachments?.length ? `[Attachment: ${replyingToMessage.attachments[0].name}]` : 'Message')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingToMessage(null)}
            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-700/40 transition cursor-pointer flex-shrink-0"
            title="Cancel reply (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Card Container (Elevated Surface #182030 in dark mode) */}
      <div className="relative">
        {/* Interactive @ Mention Autocomplete Popover (Positioned above composer with high z-index) */}
        {showMentionMenu && eligibleUsers.length > 0 && (
          <div
            ref={mentionMenuRef}
            className={`absolute bottom-full left-0 mb-3 w-[min(18rem,calc(100vw-2rem))] max-w-xs sm:w-72 max-h-64 overflow-y-auto rounded-xl border shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              isDark
                ? 'bg-[#141C2E] border-[#2A364E] text-slate-200'
                : 'bg-white border-[#BCC7D6] text-slate-800 shadow-lg'
            }`}
          >
            <div className={`px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between ${
              isDark ? 'border-[#202B3E] text-slate-400 bg-[#0F1626]' : 'border-slate-100 text-slate-500 bg-slate-50'
            }`}>
              <span>Mention Member</span>
              <span className="font-mono text-[9px] lowercase opacity-60">↑↓ to navigate • enter to select</span>
            </div>
            <div className="p-1.5 space-y-0.5">
              {eligibleUsers.slice(0, 10).map((u, idx) => {
                const isSelected = idx === mentionIndex;
                const uColor = getUserColor(u.id, u.name);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectMention(u);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-blue-600/30 text-white border border-blue-500/50 shadow-xs'
                          : 'bg-blue-50 text-blue-900 border border-blue-300 shadow-xs'
                        : isDark
                        ? 'hover:bg-slate-800/60 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Avatar user={u} size="xs" showStatus={false} />
                    <div className="min-w-0 text-left flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate" style={{ color: uColor }}>
                          {u.name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate font-mono">
                          @{u.handle}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`border ${isDark ? 'border-[#263348] bg-[#182030] focus-within:border-[#3B82F6]' : 'border-[#BCC7D6] bg-[#E8EEF5] focus-within:border-blue-500 shadow-xs'} rounded-lg transition`}>
        {/* Top Formatting Bar */}
        <div className={`flex items-center justify-between px-3 py-1.5 border-b overflow-x-auto gap-2 ${isDark ? 'border-[#263348] bg-[#182030] text-slate-300' : 'border-[#C6D0DC] bg-[#E8EEF5] text-slate-700'} text-xs`}>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => applyFormatting('bold')}
              className={`p-1 rounded font-bold transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Bold (⌘B or **text**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('italic')}
              className={`p-1 rounded italic transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Italic (⌘I or *text*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('strikethrough')}
              className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Strikethrough (⌘+Shift+X or ~~text~~)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('code')}
              className={`p-1 rounded font-mono text-xs transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Inline Code (`code`)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('link')}
              className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Hyperlink ([label](url))"
            >
              <Link className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('bullet')}
              className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Bullet List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('ordered')}
              className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Numbered List"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyFormatting('quote')}
              className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
              title="Quote Block"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-500">
            <RefreshCw className="w-3 h-3 animate-spin-reverse" />
            <span className="font-mono text-[10px]">Synced</span>
          </div>
        </div>

        {/* Emoji Selector Bar */}
        {showEmojiPicker && (
          <div className={`px-3 py-1.5 border-b ${isDark ? 'bg-slate-900 border-[#1E293B]' : 'bg-slate-50 border-slate-100'} flex items-center gap-1.5`}>
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setText(prev => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-sm p-1 hover:scale-125 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Textarea Input Container */}
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder || defaultPlaceholder}
            className={`w-full bg-transparent ${isDark ? 'text-white placeholder-slate-400' : 'text-slate-900 placeholder-slate-500'} text-sm leading-relaxed focus:outline-none resize-none max-h-40 min-h-[48px] block font-sans`}
            rows={1}
          />
        </div>

        {/* Bottom Action Bar */}
        <div className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 ${isDark ? 'bg-[#141B28] border-t border-[#263348]' : 'bg-[#DFE5EE] border-t border-[#C6D0DC]'}`}>
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 overflow-x-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              title="Attach File"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Attach File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setText(prev => prev + '```typescript\n// code snippet\n```\n');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              title="Insert Snippet"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Snippet</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1 rounded transition ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              title="Emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {/* Tag/Mention button: strictly hidden in 1:1 DMs */}
            {!isDm && (
              <button
                type="button"
                onClick={() => {
                  const prefix = text ? (text.endsWith(' ') ? text : text + ' ') : '';
                  handleTextChange(prefix + '@');
                  setTimeout(() => textareaRef.current?.focus(), 50);
                }}
                className={`p-1 rounded transition cursor-pointer ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                title="Mention user (@)"
              >
                <AtSign className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-normal hidden sm:inline ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Return to send, Shift+Return for new line
            </span>

            <button
              type="button"
              onClick={handleSend}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
