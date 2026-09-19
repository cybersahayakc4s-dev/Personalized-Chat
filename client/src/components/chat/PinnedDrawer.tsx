import React from 'react';
import { useChat } from '../../context/ChatContext';
import { MessageItem } from './MessageItem';
import { X, Pin } from 'lucide-react';

export const PinnedDrawer: React.FC = () => {
  const {
    pinnedDrawerOpen,
    setPinnedDrawerOpen,
    messages,
    users,
    currentUser,
    activeConversationId
  } = useChat() as any;

  if (!pinnedDrawerOpen) return null;

  // Filter pinned messages for the active conversation
  const pinnedMessages = (messages || []).filter(
    (m: any) => m.isPinned && !m.isDeleted && m.conversationId === activeConversationId
  );

  return (
    <div className="w-full max-w-sm border-l border-subtle bg-surface text-primary flex flex-col h-full z-20 animate-in slide-in-from-right duration-200 shadow-sm transition-colors">
      {/* Header */}
      <div className="h-14 px-4 border-b border-subtle bg-surface flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Pinned Items</h3>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded font-medium bg-surface-hover text-secondary border border-subtle">
            {pinnedMessages.length}
          </span>
        </div>
        <button
          onClick={() => setPinnedDrawerOpen(false)}
          className="w-7 h-7 rounded flex items-center justify-center transition-colors text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
          title="Close pinned drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--bg-canvas)]">
        {pinnedMessages.length === 0 ? (
          <div className="p-8 text-center text-xs">
            <Pin className="w-6 h-6 mx-auto mb-2 opacity-60 text-[var(--text-muted)]" />
            <p className="font-medium text-[var(--text-primary)]">No pinned messages in this conversation.</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Hover over any message and click the pin icon to keep important notices accessible.
            </p>
          </div>
        ) : (
          pinnedMessages.map((msg: any) => {
            const sender = (users || []).find((u: any) => u.id === msg.senderId) || currentUser;
            return (
              <div key={msg.id} className="p-1 rounded-lg border bg-[var(--bg-surface)] border-[var(--border-subtle)]">
                <MessageItem
                  message={msg}
                  sender={sender}
                  isOwnMessage={msg.senderId === currentUser?.id}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
