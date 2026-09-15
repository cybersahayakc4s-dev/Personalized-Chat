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
      <div className="fixed lg:static inset-y-0 right-0 z-50 w-full sm:w-80 lg:w-[clamp(280px,28vw,360px)] max-w-full border-l border-slate-200 bg-white flex flex-col h-full animate-in slide-in-from-right duration-200 shadow-2xl lg:shadow-sm">
        {/* Header */}
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <h3 className="font-semibold text-sm text-slate-900 truncate">Thread Discussion</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-600">
              {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveThreadMessageId(null)}
            className="p-2 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
            title="Close thread (Tap outside to close)"
            aria-label="Close thread"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-white">
        {/* Parent Root Message */}
        <div className="p-2 rounded-[6px] bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 px-2">
            Original Post
          </div>
          <MessageItem
            message={parentMessage}
            sender={parentSender}
            isOwnMessage={parentMessage.senderId === currentUser.id}
            showThreadButton={false}
          />
        </div>

        {/* Divider */}
        {threadReplies.length > 0 && (
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200 w-full" />
            <span className="absolute bg-white px-2 text-[10px] font-mono text-slate-400 uppercase">
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
