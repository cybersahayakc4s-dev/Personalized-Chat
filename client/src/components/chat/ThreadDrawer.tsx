import React from 'react';
import { useChat } from '../../context/ChatContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { X, CornerDownRight } from 'lucide-react';

export const ThreadDrawer: React.FC = () => {
  const {
    activeThreadMessageId,
    setActiveThreadMessageId,
    messages,
    users,
    currentUser
  } = useChat();

  if (!activeThreadMessageId) return null;

  const parentMessage = messages.find(m => m.id === activeThreadMessageId);
  if (!parentMessage) return null;

  const parentSender = users.find(u => u.id === parentMessage.senderId) || users[0];

  // Child replies
  const threadReplies = messages.filter(m => m.replyToId === activeThreadMessageId);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={() => setActiveThreadMessageId(null)}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer animate-in fade-in duration-150"
      />
      <div className="fixed lg:static inset-y-0 right-0 z-50 w-full sm:w-80 lg:w-96 max-w-full border-l border-subtle bg-surface flex flex-col h-full animate-in slide-in-from-right duration-200 shadow-2xl lg:shadow-xs">
        {/* Header */}
        <div className="h-16 px-4 border-b border-subtle flex items-center justify-between flex-shrink-0 bg-surface">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="w-4 h-4 text-accent flex-shrink-0" />
            <h3 className="font-semibold text-sm text-primary truncate">Thread Discussion</h3>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-surface-hover text-secondary border border-subtle">
              {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveThreadMessageId(null)}
            className="p-2 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Close thread (Tap outside to close)"
            aria-label="Close thread"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-canvas">
        {/* Parent Root Message */}
        <div className="p-2 rounded-lg bg-surface border border-subtle">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-1 px-2">
            Original Post
          </div>
          <MessageItem
            className="mt-0"
            message={parentMessage}
            sender={parentSender}
            isOwnMessage={parentMessage.senderId === currentUser.id}
            showThreadButton={false}
          />
        </div>

        {/* Divider */}
        {threadReplies.length > 0 && (
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-subtle w-full" />
            <span className="absolute bg-surface px-2 text-xs font-mono text-muted uppercase">
              Replies
            </span>
          </div>
        )}

        {/* Thread Replies */}
        <div className="space-y-2">
          {threadReplies.map(reply => {
            const sender = users.find(u => u.id === reply.senderId) || users[0];
            return (
              <MessageItem
                key={reply.id}
                className="mt-1"
                message={reply}
                sender={sender}
                isOwnMessage={reply.senderId === currentUser.id}
                showThreadButton={false}
              />
            );
          })}
        </div>
      </div>

      {/* Reply Input with Full Rich Text Formatting */}
      <MessageInput
        replyToId={activeThreadMessageId}
        placeholder={`Reply to @${parentSender.handle} with rich text...`}
      />
    </div>
  </>
);
};
