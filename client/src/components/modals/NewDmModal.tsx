import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { TeamBadge, RoleBadge } from '../common/Badge';
import { X, Search, MessageSquare, Shield } from 'lucide-react';

export const NewDmModal: React.FC = () => {
  const {
    newDmModalOpen,
    setNewDmModalOpen,
    users,
    currentUser,
    createOrOpenDm,
    theme
  } = useChat() as any;

  const [query, setQuery] = useState('');

  if (!newDmModalOpen) return null;

  const isDark = theme !== 'light';

  // Filter candidates (exclude self and deleted users)
  const candidates = users.filter(
    (u: any) =>
      u.id !== currentUser.id &&
      u.account_status !== 'deleted' &&
      u.status !== 'deleted' &&
      u.name !== '[Deleted User]' &&
      (u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.handle.toLowerCase().includes(query.toLowerCase()) ||
        (u.team && u.team.toLowerCase().includes(query.toLowerCase())))
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setNewDmModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-subtle text-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all cursor-default"
      >
        {/* Header */}
        <div className="p-4 border-b border-subtle bg-surface flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent-muted text-accent">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-primary">
                Start Direct Message
              </h3>
              <p className="text-xs font-mono text-secondary">
                1:1 Cryptographically Isolated Thread
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewDmModalOpen(false)}
            className="p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-secondary hover:text-primary hover:bg-surface-hover active:bg-surface-hover"
            title="Close modal (Tap outside to close)"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-subtle">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search colleagues by name, handle, or team..."
              autoFocus
              className="w-full h-9 pl-9 pr-3 rounded-lg border text-xs focus:outline-hidden bg-canvas border-subtle text-primary focus:border-focus"
            />
          </div>
        </div>

        {/* User List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {candidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">
              No matching colleagues found.
            </div>
          ) : (
            candidates.map((user: any) => (
              <button
                key={user.id}
                onClick={() => createOrOpenDm(user.id)}
                className="w-full flex items-center justify-between p-2 rounded-lg border border-transparent transition text-left group hover:bg-surface-hover hover:border-subtle cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar user={user} size="sm" showStatus={true} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs truncate text-primary">
                        {user.name}
                      </span>
                      {user.role === 'main_admin' && <RoleBadge role="main_admin" size="sm" />}
                    </div>
                    <div className="text-xs truncate font-mono text-secondary">
                      @{user.handle} • {user.title}
                    </div>
                  </div>
                </div>

                <TeamBadge team={user.team} size="sm" />
              </button>
            ))
          )}
        </div>

        {/* Footer info on DM privacy */}
        <div className="p-3 bg-surface border-t border-subtle text-xs flex items-center gap-2 font-mono text-secondary">
          <Shield className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span>Notice: Direct messages are end-to-end encrypted between participants.</span>
        </div>
      </div>
    </div>
  );
};
