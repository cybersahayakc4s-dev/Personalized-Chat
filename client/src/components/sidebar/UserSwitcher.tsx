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
      className="w-full flex items-center justify-between p-2 rounded-md transition-all text-left group hover:bg-[#131B2E] text-slate-200 cursor-pointer select-none"
      title="Click to view user profile details"
    >
      {/* Profile Info: Avatar, Name, CEO badge, Designation */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Avatar user={currentUser} size="sm" showStatus={true} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs truncate text-white group-hover:text-blue-300 transition-colors">
              {currentUser.name}
            </span>
            {currentUser.role === 'main_admin' && (
              <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                CEO
              </span>
            )}
            {currentUser.is_team_leader && currentUser.role !== 'main_admin' && (
              <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                Lead
              </span>
            )}
          </div>
          <div className="text-[11px] truncate text-slate-400">
            {currentUser.title || `@${currentUser.handle}`}
          </div>
        </div>
      </div>

      {/* Right Side: On hover, option to change status to busy / online */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1.5">
        {/* Hover action toggle */}
        <button
          type="button"
          onClick={handleToggleBusy}
          className={`opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer shadow-xs ${
            isBusy
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
          }`}
          title={isBusy ? 'Click to set Available' : 'Click to set Busy'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span>{isBusy ? 'Set Online' : 'Set Busy'}</span>
        </button>

        {/* Static status indicator (visible when not hovered) */}
        <div
          className="group-hover:hidden flex items-center justify-center w-4 h-4 mr-0.5"
          title={isBusy ? 'Status: Busy' : currentUser.status === 'online' ? 'Status: Online' : 'Status: Offline'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBusy
                ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
                : currentUser.status === 'online'
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                : 'bg-slate-500/80'
            }`}
          />
        </div>

      </div>
    </div>
  );
};
