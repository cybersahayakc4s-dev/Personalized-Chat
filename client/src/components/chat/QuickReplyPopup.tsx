import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { Send, X, Clock, Check, Phone, ThumbsUp, Briefcase } from 'lucide-react';

const PRESET_CHIPS = [
  { label: 'Okay', icon: ThumbsUp, text: 'Okay' },
  { label: 'Busy, reply soon', icon: Clock, text: 'I am busy right now, will reply soon.' },
  { label: 'Working on it', icon: Briefcase, text: 'Working on it now.' },
  { label: 'Received, thanks', icon: Check, text: 'Received, thank you!' },
  { label: 'Call me when free', icon: Phone, text: 'Please call me when you are free.' }
];

export const QuickReplyPopup: React.FC = () => {
  const {
    quickReplyState,
    closeQuickReply,
    sendQuickReply,
    users,
    theme
  } = useChat() as any;

  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickReplyState?.isOpen) {
      setReplyText('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [quickReplyState?.isOpen]);

  if (!quickReplyState?.isOpen) return null;

  const senderUser = users?.find((u: any) => u.id === quickReplyState.senderId) || {
    name: quickReplyState.senderName || 'Colleague',
    handle: quickReplyState.senderHandle || 'user',
    status: 'online',
    team: 'team_ai'
  };

  const handleSend = async (contentToSend: string) => {
    const text = contentToSend.trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      await sendQuickReply(quickReplyState.conversationId, text);
      closeQuickReply();
    } catch (e) {
      console.warn('Quick reply failed:', e);
    } finally {
      setIsSending(false);
    }
  };

  const isDark = theme !== 'nordic';

  return (
    <div className="fixed bottom-5 right-5 z-[var(--z-quickreply,80)] max-w-sm w-[calc(100vw-2.5rem)] sm:w-96 animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
        isDark
          ? 'bg-[#151D2A]/95 border-[#2A3852] text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.6)]'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-[0_12px_36px_rgba(0,0,0,0.15)]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/40 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar user={senderUser as any} size="sm" showStatus={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs truncate">{senderUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono font-medium">
                  Quick Reply
                </span>
              </div>
              {quickReplyState.messagePreview && (
                <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  "{quickReplyState.messagePreview}"
                </p>
              )}
            </div>
          </div>

          <button
            onClick={closeQuickReply}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
            title="Close"
            aria-label="Close quick reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Quick Chips */}
        <div className="py-2.5 flex flex-wrap gap-1.5">
          {PRESET_CHIPS.map(chip => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.label}
                disabled={isSending}
                onClick={() => handleSend(chip.text)}
                className={`text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer font-medium border ${
                  isDark
                    ? 'bg-[#1C2638] hover:bg-blue-600 hover:text-white hover:border-blue-500 border-[#2E3C54] text-slate-300'
                    : 'bg-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-500 border-slate-200 text-slate-700'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Inline Custom Input */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend(replyText);
          }}
          className="mt-1 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a fast message... (Enter to send)"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            disabled={isSending}
            className={`flex-1 px-3 py-2 rounded-xl text-xs outline-hidden border transition-all ${
              isDark
                ? 'bg-[#0E1420] border-[#2A3852] focus:border-blue-500 text-white placeholder-slate-500'
                : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-400'
            }`}
          />
          <button
            type="submit"
            disabled={!replyText.trim() || isSending}
            className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs"
            title="Send quick reply"
            aria-label="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
