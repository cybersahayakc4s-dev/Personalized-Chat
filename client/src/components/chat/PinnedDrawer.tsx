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
    activeConversationId,
    theme
  } = useChat() as any;

  if (!pinnedDrawerOpen) return null;

  const isDark = theme === 'slate';

  // Filter pinned messages for the active conversation
  const pinnedMessages = messages.filter(
    (m: any) => m.isPinned && m.conversationId === activeConversationId
  );

  return (
    <div className={`w-80 lg:w-[360px] border-l ${
      isDark ? 'border-zinc-800 bg-[#18181B] text-zinc-100' : 'border-slate-200 bg-white text-slate-900'
    } flex flex-col h-full z-20 animate-in slide-in-from-right duration-200 shadow-sm transition-colors`}>
      {/* Header */}
      <div className={`h-14 px-4 border-b ${
        isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-slate-200 bg-white'
      } flex items-center justify-between flex-shrink-0`}>
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Pinned Items</h3>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
          }`}>
            {pinnedMessages.length}
          </span>
        </div>
        <button
          onClick={() => setPinnedDrawerOpen(false)}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Close pinned drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${isDark ? 'bg-[#18181B]' : 'bg-white'}`}>
        {pinnedMessages.length === 0 ? (
          <div className="p-8 text-center text-xs">
            <Pin className={`w-6 h-6 mx-auto mb-2 opacity-60 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
            <p className={`font-medium ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>No pinned messages in this conversation.</p>
            <p className={`mt-1 text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Hover over any message and click the pin icon to keep important notices accessible.
            </p>
          </div>
        ) : (
          pinnedMessages.map((msg: any) => {
            const sender = users.find((u: any) => u.id === msg.senderId) || currentUser;
            return (
              <div key={msg.id} className={`p-1 rounded-lg border shadow-2xs ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <MessageItem
                  message={msg}
                  sender={sender}
                  isOwnMessage={msg.senderId === currentUser.id}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
