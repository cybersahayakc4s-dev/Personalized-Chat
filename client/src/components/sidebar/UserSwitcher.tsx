import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';

export const UserSwitcher: React.FC = () => {
  const {
    currentUser,
    updateUserStatus,
    setProfileModalUser
  } = useChat() as any;

  if (!currentUser) return null;

  const isBusy = currentUser.status === 'busy';

  const handleToggleBusy = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateUserStatus(isBusy ? 'online' : 'busy');
  };

  return (
    <div
      onClick={() => setProfileModalUser(currentUser)}
      className="w-full flex items-center justify-between p-2 rounded-md transition-colors text-left group hover:bg-surface-hover text-primary cursor-pointer select-none"
      title="Click to view user profile details"
    >
      {/* Profile Info: Avatar, Name, CEO badge, Designation */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Avatar user={currentUser} size="sm" showStatus={true} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs truncate text-primary group-hover:text-primary transition-colors">
              {currentUser.name}
            </span>
            {currentUser.role === 'main_admin' && (
              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-surface-hover text-primary font-medium border border-subtle">
                CEO
              </span>
            )}
            {currentUser.is_team_leader && currentUser.role !== 'main_admin' && (
              <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-surface-hover text-secondary font-medium border border-subtle">
                Lead
              </span>
            )}
          </div>
          <div className="text-xs truncate text-muted">
            {currentUser.title || `@${currentUser.handle}`}
          </div>
        </div>
      </div>

      {/* Right Side: On hover, option to change status */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1.5">
        {/* Hover action toggle */}
        <button
          type="button"
          onClick={handleToggleBusy}
          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 cursor-pointer border border-subtle bg-surface-hover text-secondary hover:text-primary"
          title={isBusy ? 'Click to set Available' : 'Click to set Busy'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isBusy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          <span>{isBusy ? 'Set Online' : 'Set Busy'}</span>
        </button>

        {/* Static status indicator */}
        <div
          className="group-hover:hidden flex items-center justify-center h-4 w-4 mr-0.5"
          title={isBusy ? 'Status: Busy' : currentUser.status === 'online' ? 'Status: Online' : 'Status: Offline'}
        >
          <span
            className={`h-2 w-2 rounded-full border border-subtle ${
              isBusy
                ? 'bg-rose-500 ring-1 ring-rose-500/20'
                : currentUser.status === 'online'
                ? 'bg-emerald-500 ring-1 ring-emerald-500/20'
                : 'bg-slate-400 dark:bg-zinc-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
