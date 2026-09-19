import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { Search, X, ChevronUp, ChevronDown, Filter, FileText, User as UserIcon } from 'lucide-react';
import { Avatar } from '../common/Avatar';

interface InChatSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
  currentMatchIndex: number;
  matchingMessageIds: string[];
}

export const InChatSearchBar: React.FC<InChatSearchBarProps> = ({
  isOpen,
  onClose,
  onSelectMessage,
  currentMatchIndex,
  matchingMessageIds
}) => {
  const {
    activeConversation,
    activeConversationId,
    messages,
    users,
    isDm
  } = useChat();

  const [query, setQuery] = useState('');
  const [filterSenderId, setFilterSenderId] = useState<string>('all');
  const [filterOnlyAttachments, setFilterOnlyAttachments] = useState(false);
  const [showResultsList, setShowResultsList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
      setShowResultsList(false);
    }
  }, [isOpen]);

  // Messages in this conversation only
  const conversationMessages = useMemo(() => {
    return messages.filter(m => m.conversationId === activeConversationId);
  }, [messages, activeConversationId]);

  // Distinct senders in this conversation
  const sendersInConversation = useMemo(() => {
    const senderIds = Array.from(new Set(conversationMessages.map(m => m.senderId)));
    return senderIds.map(id => users.find(u => u.id === id)).filter(Boolean) as typeof users;
  }, [conversationMessages, users]);

  // Filtered matching messages in this conversation
  const matches = useMemo(() => {
    return conversationMessages.filter(msg => {
      // Query match
      if (query.trim()) {
        const lowerQ = query.toLowerCase();
        const contentMatch = (msg.content || '').toLowerCase().includes(lowerQ);
        const safeAtts = Array.isArray(msg.attachments) ? msg.attachments : [];
        const attachmentMatch = safeAtts.some(att => (att?.name || '').toLowerCase().includes(lowerQ));
        if (!contentMatch && !attachmentMatch) return false;
      } else if (!filterOnlyAttachments && filterSenderId === 'all') {
        // If no query and no filters, don't return all
        return false;
      }

      // Sender filter
      if (filterSenderId !== 'all' && msg.senderId !== filterSenderId) {
        return false;
      }

      // Attachment filter
      if (filterOnlyAttachments) {
        const safeAtts = Array.isArray(msg.attachments) ? msg.attachments : [];
        if (safeAtts.length === 0) return false;
      }

      return true;
    });
  }, [conversationMessages, query, filterSenderId, filterOnlyAttachments]);

  const totalMatches = matches.length;

  const handleNext = () => {
    if (totalMatches === 0) return;
    const nextIdx = (currentMatchIndex + 1) % totalMatches;
    onSelectMessage(matches[nextIdx].id);
  };

  const handlePrev = () => {
    if (totalMatches === 0) return;
    const prevIdx = (currentMatchIndex - 1 + totalMatches) % totalMatches;
    onSelectMessage(matches[prevIdx].id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  if (!isOpen) return null;

  const conversationName = isDm
    ? (activeConversation as { otherUser?: { name: string } })?.otherUser?.name || 'Direct Message'
    : `#${(activeConversation as { name?: string })?.name || 'channel'}`;

  return (
    <div className="bg-surface border-b border-subtle shadow-xs px-4 py-2.5 z-20 animate-in slide-in-from-top-2 duration-150">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: In-chat Scope indicator & Search Input */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0 max-w-xl">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-hover border border-subtle text-secondary text-xs font-medium truncate shrink-0 max-w-36 sm:max-w-none">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">In {conversationName}</span>
          </div>

          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setShowResultsList(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Search messages in ${conversationName}...`}
              className="w-full h-8 pl-3 pr-8 rounded-md bg-canvas border border-subtle text-primary placeholder:text-muted text-xs focus:outline-hidden focus:border-focus font-body shadow-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-2 text-muted hover:text-primary cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Center: Match count & Next/Prev navigation */}
        <div className="flex items-center gap-2 text-xs">
          {query.trim() || filterSenderId !== 'all' || filterOnlyAttachments ? (
            <div className="flex items-center gap-1.5 text-secondary font-mono text-xs bg-surface px-2.5 py-1 rounded-md border border-subtle shadow-xs">
              {totalMatches === 0 ? (
                <span className="text-danger font-medium">0 matches</span>
              ) : (
                <span>
                  <strong>{currentMatchIndex + 1}</strong> of <strong>{totalMatches}</strong> match{totalMatches > 1 ? 'es' : ''}
                </span>
              )}
            </div>
          ) : null}

          {totalMatches > 0 && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-subtle flex items-center justify-center text-secondary hover:text-primary transition-colors shadow-xs cursor-pointer"
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="h-8 w-8 rounded-md bg-surface hover:bg-surface-hover border border-subtle flex items-center justify-center text-secondary hover:text-primary transition-colors shadow-xs cursor-pointer"
                title="Next match (Enter)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Senders Filter Dropdown */}
          <div className="flex items-center gap-1">
            <select
              value={filterSenderId}
              onChange={e => setFilterSenderId(e.target.value)}
              className="h-8 px-2.5 rounded-md bg-surface border border-subtle text-primary text-xs focus:outline-hidden focus:border-focus shadow-xs font-sans cursor-pointer transition-colors"
              title="Filter by sender in this chat"
            >
              <option value="all" className="bg-surface text-primary">All senders</option>
              {sendersInConversation.map(sender => (
                <option key={sender.id} value={sender.id} className="bg-surface text-primary">
                  {sender.name}
                </option>
              ))}
            </select>

            {/* Attachments only toggle */}
            <button
              type="button"
              onClick={() => setFilterOnlyAttachments(!filterOnlyAttachments)}
              className={`h-8 px-2 rounded-md text-xs font-medium border flex items-center gap-1 transition-colors shadow-xs cursor-pointer ${
                filterOnlyAttachments
                  ? 'bg-accent-muted border-accent text-accent'
                  : 'bg-surface border-subtle text-secondary hover:text-primary'
              }`}
              title="Only show messages with file attachments"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Files</span>
            </button>
          </div>

          {/* Close In-Chat Search Button */}
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover transition-colors ml-1 cursor-pointer"
            title="Close in-chat search (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Results Drawer Dropdown if user has matches */}
      {showResultsList && matches.length > 0 && query.trim() && (
        <div className="mt-2 pt-2 border-t border-subtle max-h-48 overflow-y-auto space-y-1">
          <div className="text-xs font-mono uppercase text-muted tracking-wider flex items-center justify-between px-1">
            <span>Matches in this chat ({matches.length})</span>
            <button
              onClick={() => setShowResultsList(false)}
              className="hover:text-primary text-xs normal-case underline cursor-pointer"
            >
              Hide list
            </button>
          </div>
          {matches.map((msg, idx) => {
            const sender = users.find(u => u.id === msg.senderId);
            const isCurrent = idx === currentMatchIndex;

            return (
              <button
                key={msg.id}
                type="button"
                onClick={() => {
                  onSelectMessage(msg.id);
                }}
                className={`w-full text-left p-2 rounded-md flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-surface-hover border border-focus text-primary font-medium shadow-xs'
                    : 'bg-surface hover:bg-surface-hover border border-subtle text-secondary'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-semibold text-primary truncate max-w-28">
                    {sender?.name}
                  </span>
                  <span className="text-muted text-xs">•</span>
                  <span className="truncate text-secondary max-w-md">
                    {msg.content}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted flex-shrink-0">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
