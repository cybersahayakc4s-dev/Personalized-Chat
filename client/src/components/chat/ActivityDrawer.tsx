import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import {
  Bell,
  X,
  CheckCheck,
  AtSign,
  Clock,
  ExternalLink,
  Inbox
} from 'lucide-react';
import { formatSidebarTime } from '../../utils/date';

export const ActivityDrawer: React.FC = () => {
  const {
    activityDrawerOpen,
    setActivityDrawerOpen,
    activityNotifications = [],
    dismissNotification,
    clearAllNotifications,
    setActiveConversationId,
    users
  } = useChat() as any;

  if (!activityDrawerOpen) return null;

  const handleOpenConversation = (conversationId: string, notifId: string) => {
    setActiveConversationId(conversationId);
    dismissNotification(notifId);
    setActivityDrawerOpen(false);
  };

  // Close drawer on Escape key press
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivityDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivityDrawerOpen]);

  return (
    <>
      {/* Outside Click Backdrop Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs transition-opacity animate-in fade-in duration-150 cursor-pointer"
        onClick={() => setActivityDrawerOpen(false)}
        aria-hidden="true"
      />

      <aside
        aria-label="Activity and Mentions"
        className="fixed inset-y-0 right-0 z-50 w-80 max-w-full bg-surface border-l border-subtle flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 select-none"
      >
      {/* Header */}
      <div className="h-16 px-4 border-b border-subtle flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-surface-hover border border-subtle flex items-center justify-center text-primary">
            <Bell className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-primary tracking-tight">
              Activity & Mentions
            </h2>
            <p className="text-xs text-muted">
              {activityNotifications.length === 0
                ? 'All caught up'
                : `${activityNotifications.length} notification${activityNotifications.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activityNotifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="p-1.5 rounded-md text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              title="Clear all notifications"
              aria-label="Clear all notifications"
            >
              <CheckCheck className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setActivityDrawerOpen(false)}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Close"
            aria-label="Close activity drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {activityNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full py-16 px-4 text-muted">
            <div className="h-12 w-12 rounded-full bg-surface-hover border border-subtle flex items-center justify-center mb-3 text-muted">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-primary">No new activity</p>
            <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
              When colleagues @mention you or send new direct messages, they will appear here.
            </p>
          </div>
        ) : (
          activityNotifications.map((item: any) => {
            const senderUser = users.find((u: any) => u.id === item.senderId);
            const isMention = item.type === 'mention';

            return (
              <div
                key={item.id}
                className="group relative flex items-start gap-3 p-3 rounded-xl bg-surface-hover/50 hover:bg-surface-hover border border-subtle transition-all cursor-pointer"
                onClick={() => handleOpenConversation(item.conversationId, item.id)}
              >
                {/* Dismiss 'X' button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(item.id);
                  }}
                  className="absolute top-2.5 right-2.5 h-6 w-6 rounded-md flex items-center justify-center text-muted hover:text-primary hover:bg-surface border border-transparent hover:border-subtle transition-colors cursor-pointer"
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Avatar / Sender */}
                <div className="relative shrink-0 mt-0.5">
                  {senderUser ? (
                    <Avatar user={senderUser} size="sm" showStatus={false} />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-surface flex items-center justify-center border border-subtle font-semibold text-xs text-secondary">
                      {item.senderName ? item.senderName.substring(0, 2).toUpperCase() : 'U'}
                    </div>
                  )}
                  {isMention && (
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-accent text-white flex items-center justify-center text-xs shadow-xs">
                      <AtSign className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>

                {/* Info & Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-primary truncate">
                      {item.senderName}
                    </span>
                    <span className="text-xs text-muted truncate">
                      in {item.conversationName}
                    </span>
                  </div>

                  <p className="text-xs text-secondary line-clamp-2 mt-1 leading-relaxed break-words">
                    {item.content}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs text-muted mt-2">
                    <Clock className="h-3 w-3" />
                    <span>{formatSidebarTime(item.timestamp)}</span>
                    <span className="text-accent font-medium ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-subtle bg-surface text-center">
        <p className="text-xs text-muted">
          Click an item to jump to the conversation, or click &times; to dismiss.
        </p>
      </div>
      </aside>
    </>
  );
};
