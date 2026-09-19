import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { Attachment, User } from '../../types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  AtSign,
  FileCode,
  Lock,
  Film,
  Reply
} from 'lucide-react';
import { applySmartFormatting, handleSmartEnter, handleFormattingShortcuts, FormatType } from '../../utils/textFormatting';

interface MessageInputProps {
  placeholder?: string;
  replyToId?: string;
}

const EMOJIS = ['👍', '❤️', '🔥', '🚀', '🔒', '💡', '👀', '🎉', '👋', '🎯', '⚡', '✨'];

export const MessageInput: React.FC<MessageInputProps> = ({ placeholder }) => {
  const {
    activeConversationId,
    activeConversation,
    isDm,
    currentUser,
    users = [],
    sendMessage,
    replyingToMessage,
    setReplyingToMessage
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

  // Read-only and posting permission checks
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

  let isReadOnly = false;
  let readOnlyMessage = "This channel is read-only.";

  if (isDeletedRecipient) {
    isReadOnly = true;
    readOnlyMessage = "This user account has been deleted. You cannot send new messages.";
  } else if (isDisabledRecipient) {
    isReadOnly = true;
    readOnlyMessage = "This user account is currently deactivated. You cannot send messages.";
  } else if (isAnnouncement && currentUser?.role !== 'main_admin') {
    isReadOnly = true;
    readOnlyMessage = "This channel is read-only. Only Main-Admin (CEO) can post announcements.";
  } else if (isUpdates) {
    const isLeadOrAdmin = currentUser?.role === 'main_admin' || Boolean(currentUser?.is_team_leader) || (currentUser?.title && currentUser.title.toLowerCase().includes('lead'));
    if (!isLeadOrAdmin) {
      isReadOnly = true;
      readOnlyMessage = "This channel is read-only. Only Leads and Admins can post updates.";
    }
  }

  const applyFormatting = (formatType: FormatType) => {
    if (!textareaRef.current) return;
    applySmartFormatting(textareaRef.current, text, setText, formatType);
  };

  const replySender = React.useMemo(() => {
    if (!replyingToMessage) return null;
    return users.find((u: any) => u.id === replyingToMessage.senderId) || null;
  }, [replyingToMessage, users]);

  // Mention filtering
  const eligibleUsers = React.useMemo(() => {
    if (isDm || !showMentionMenu) return [];
    const query = mentionQuery.toLowerCase();
    return users.filter((u: any) => {
      if (u.id === currentUser?.id) return false;
      if (u.account_status === 'deleted' || u.status === 'deleted') return false;
      if (!query) return true;
      return (
        u.name.toLowerCase().includes(query) ||
        u.handle.toLowerCase().includes(query)
      );
    });
  }, [isDm, showMentionMenu, mentionQuery, users, currentUser]);

  const handleSelectMention = (user: User) => {
    if (!user || !user.handle) {
      setShowMentionMenu(false);
      return;
    }
    const mentionTag = `@${user.handle} `;
    const atPos = text.lastIndexOf('@');
    if (atPos !== -1) {
      const newText = text.substring(0, atPos) + mentionTag;
      setText(newText);
    } else {
      setText(prev => prev + mentionTag);
    }
    setShowMentionMenu(false);
    setMentionQuery('');
    textareaRef.current?.focus();
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (!isDm) {
      const cursor = textareaRef.current?.selectionStart ?? val.length;
      const textUpToCursor = val.slice(0, cursor);
      const atMatch = textUpToCursor.match(/@([a-zA-Z0-9_-]*)$/);
      if (atMatch) {
        setShowMentionMenu(true);
        setMentionQuery(atMatch[1]);
        setMentionIndex(0);
      } else {
        setShowMentionMenu(false);
      }
    } else if (showMentionMenu) {
      setShowMentionMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Navigate mention popup
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
        const targetUser = eligibleUsers[mentionIndex];
        if (targetUser) {
          handleSelectMention(targetUser);
        } else {
          setShowMentionMenu(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    // Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K)
    const handledShortcut = handleFormattingShortcuts(e, textareaRef.current, text, setText);
    // Smart Enter (Shift+Enter adds newline; Enter sends)
    if (textareaRef.current) {
      const isHandled = handleSmartEnter(e, textareaRef.current, text, setText);
      if (isHandled) return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    const currentAttachments = [...attachments];
    const currentReplyId = replyingToMessage?.id;

    setText('');
    setAttachments([]);
    setReplyingToMessage(null);
    setShowEmojiPicker(false);
    setShowMentionMenu(false);

    try {
      await sendMessage(trimmed, currentAttachments, currentReplyId);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      isSubmittingRef.current = false;
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  // 1. Read-Only State Handling (NEW-DESIGN.md Section 4.2)
  if (isReadOnly) {
    return (
      <div className="p-4 border-t border-subtle bg-canvas shrink-0">
        <div className="w-full p-3 rounded-lg border border-subtle bg-surface-hover flex items-center justify-center gap-2 text-muted text-sm">
          <Lock size={16} />
          <span>{readOnlyMessage}</span>
        </div>
      </div>
    );
  }

  const recipientName = isDm
    ? (activeConversation as any)?.otherUser?.name || 'Colleague'
    : (activeConversation as any)?.name || 'channel';

  const defaultPlaceholder = `Message ${isDm ? recipientName : '#' + recipientName}...`;

  return (
    <div className="p-4 border-t border-subtle bg-canvas/60 backdrop-blur-xs shrink-0">
      {/* Hidden File Input */}
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

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map(att => {
            const isImg = att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name);
            const isVid = att.type?.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(att.name);

            return (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border border-subtle bg-surface text-primary"
              >
                {isImg ? (
                  <img src={att.url} alt={att.name} className="h-8 w-8 object-cover rounded" />
                ) : isVid ? (
                  <Film className="h-4 w-4 text-secondary" />
                ) : (
                  <FileText className="h-4 w-4 text-secondary" />
                )}
                <div className="flex flex-col min-w-0 max-w-xs">
                  <span className="truncate text-xs font-medium">{att.name}</span>
                  <span className="text-xs text-muted">{(att.size / 1024).toFixed(1)} KB</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                  className="p-1 text-muted hover:text-primary rounded cursor-pointer"
                  title="Remove attachment"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Quoted Reply Banner */}
      {replyingToMessage && (
        <div className="mb-2 px-3 py-1.5 rounded-md border-l-2 border-accent bg-surface-hover flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="font-semibold text-accent truncate shrink-0">
              Replying to {replySender?.name || 'Message'}:
            </span>
            <span className="truncate text-secondary italic">
              {replyingToMessage.content || '[Attachment]'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyingToMessage(null)}
            className="p-1 rounded text-muted hover:text-primary transition-colors shrink-0 cursor-pointer"
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Active State Handling: Container */}
      <div className="relative">
        {/* @ Mention Autocomplete Popover */}
        {showMentionMenu && eligibleUsers.length > 0 && (
          <div
            ref={mentionMenuRef}
            className="absolute bottom-full left-0 mb-2 w-64 max-h-60 overflow-y-auto rounded-md border border-subtle bg-surface p-1 shadow-md z-30"
          >
            <div className="px-2 py-1 text-xs font-medium text-muted uppercase tracking-wider">
              Mention Member
            </div>
            {eligibleUsers.slice(0, 8).map((u, idx) => {
              const isSelected = idx === mentionIndex;
              return (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleSelectMention(u);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-surface-hover text-primary' : 'text-secondary hover:bg-surface-hover hover:text-primary'
                  }`}
                >
                  <Avatar className="h-5 w-5 rounded-sm text-xs">
                    <AvatarImage src={u.avatarUrl || u.avatar} />
                    <AvatarFallback className="rounded-sm bg-surface-hover text-secondary text-xs">
                      {u.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-medium text-primary">{u.name}</span>
                    <span className="text-muted">@{u.handle}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Emoji Selector Bar */}
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-2 flex items-center gap-1 rounded-md border border-subtle bg-surface p-1 shadow-md z-20">
            {EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setText(prev => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="h-7 w-7 rounded hover:bg-surface-hover flex items-center justify-center text-sm transition-transform hover:scale-110 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Composer Box (Active State per NEW-DESIGN.md Section 4.2) */}
        <div className="border border-subtle bg-surface focus-within:border-focus rounded-lg p-3 transition-colors">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder || defaultPlaceholder}
            className="w-full bg-transparent resize-none outline-none text-sm text-primary placeholder:text-muted font-sans min-h-12 max-h-40 block"
            rows={1}
          />

          {/* Bottom Action Row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-subtle">
            {/* Formatting & Attachment Action Buttons */}
            <div className="flex items-center gap-1 text-secondary">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('bold')}
                    aria-label="Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Bold</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('italic')}
                    aria-label="Italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Italic</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('strikethrough')}
                    aria-label="Strikethrough"
                  >
                    <Strikethrough className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Strikethrough</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('code')}
                    aria-label="Inline Code"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Code</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('link')}
                    aria-label="Link"
                  >
                    <Link className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Link</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('bullet')}
                    aria-label="Bulleted List"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Bulleted List</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('ordered')}
                    aria-label="Numbered List"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Numbered List</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => applyFormatting('quote')}
                    aria-label="Quote"
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Quote</TooltipContent>
              </Tooltip>

              <div className="h-4 w-px bg-subtle mx-1" />

              {/* Attachment Icon Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach File"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Attach File</TooltipContent>
              </Tooltip>

              {/* Snippet Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => setText(prev => prev + '```typescript\n// code snippet\n```\n')}
                    aria-label="Code Snippet"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Code Snippet</TooltipContent>
              </Tooltip>

              {/* Emoji Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    aria-label="Emoji Picker"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Emoji</TooltipContent>
              </Tooltip>

              {/* Mention Button (Non-DM) */}
              {!isDm && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                      onClick={() => {
                        const prefix = text ? (text.endsWith(' ') ? text : text + ' ') : '';
                        handleTextChange(prefix + '@');
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                      aria-label="Mention someone"
                    >
                      <AtSign className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Mention Member</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Primary Send Button (NEW-DESIGN.md Section 4.2: bg-accent hover:bg-accent-hover) */}
            <Button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() && attachments.length === 0}
              className="h-8 px-3 rounded-md bg-accent hover:bg-accent-hover text-xs font-medium text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Send</span>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
