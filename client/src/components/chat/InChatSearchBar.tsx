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
        const contentMatch = msg.content.toLowerCase().includes(lowerQ);
        const attachmentMatch = msg.attachments?.some(att => att.name.toLowerCase().includes(lowerQ));
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
      if (filterOnlyAttachments && (!msg.attachments || msg.attachments.length === 0)) {
        return false;
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
    <div className="bg-slate-50 border-b border-slate-200 shadow-xs px-4 py-2.5 z-20 animate-in slide-in-from-top-2 duration-150">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: In-chat Scope indicator & Search Input */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 min-w-0 max-w-xl">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium truncate shrink-0 max-w-[150px] sm:max-w-none">
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
              className="w-full h-8 pl-3 pr-8 rounded-[4px] bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-body shadow-xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Center: Match count & Next/Prev navigation */}
        <div className="flex items-center gap-2 text-xs">
          {query.trim() || filterSenderId !== 'all' || filterOnlyAttachments ? (
            <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px] bg-white px-2.5 py-1 rounded-[4px] border border-slate-200 shadow-xs">
              {totalMatches === 0 ? (
                <span className="text-rose-600 font-medium">0 matches</span>
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
                className="h-8 w-8 rounded-[4px] bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
                title="Previous match (Shift+Enter)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="h-8 w-8 rounded-[4px] bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
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
              className="h-8 px-2 rounded-[4px] bg-white border border-slate-200 text-slate-700 text-xs focus:outline-hidden focus:border-blue-600 shadow-xs font-sans"
              title="Filter by sender in this chat"
            >
              <option value="all">All senders</option>
              {sendersInConversation.map(sender => (
                <option key={sender.id} value={sender.id}>
                  {sender.name}
                </option>
              ))}
            </select>

            {/* Attachments only toggle */}
            <button
              type="button"
              onClick={() => setFilterOnlyAttachments(!filterOnlyAttachments)}
              className={`h-8 px-2 rounded-[4px] text-xs font-medium border flex items-center gap-1 transition-colors shadow-xs ${
                filterOnlyAttachments
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
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
            className="h-8 w-8 rounded-[4px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors ml-1"
            title="Close in-chat search (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Results Drawer Dropdown if user has matches */}
      {showResultsList && matches.length > 0 && query.trim() && (
        <div className="mt-2 pt-2 border-t border-slate-200 max-h-48 overflow-y-auto space-y-1">
          <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider flex items-center justify-between px-1">
            <span>Matches in this chat ({matches.length})</span>
            <button
              onClick={() => setShowResultsList(false)}
              className="hover:text-slate-700 text-[10px] normal-case underline"
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
                className={`w-full text-left p-2 rounded-[4px] flex items-center justify-between gap-3 text-xs transition-colors ${
                  isCurrent
                    ? 'bg-blue-50 border border-blue-300 text-blue-900'
                    : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                    {sender?.name}
                  </span>
                  <span className="text-slate-400 text-[10px]">•</span>
                  <span className="truncate text-slate-600 max-w-md">
                    {msg.content}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">
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
