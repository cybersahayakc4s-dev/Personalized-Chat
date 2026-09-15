import React from 'react';
import { useChat } from '../../context/ChatContext';
import { ShieldAlert, Lock, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { TEAMS_META } from '../../data/initialData';
import { getUserDepartmentChannel } from '../../utils/rbac';

export const UnauthorizedModal: React.FC = () => {
  const {
    unauthorizedModalData,
    setUnauthorizedModalData,
    currentUser,
    channels,
    setActiveConversationId,
    theme
  } = useChat() as any;

  if (!unauthorizedModalData?.isOpen) return null;

  const isDark = theme === 'slate';
  const requestedTeamName = unauthorizedModalData.teamName || 'Department';
  const requestedTeamId = unauthorizedModalData.teamId;

  // Dynamically resolve user's department display name
  const userTeamId = currentUser?.team;
  const userTeamMeta = userTeamId && (TEAMS_META as any)[userTeamId]
    ? (TEAMS_META as any)[userTeamId]
    : { name: userTeamId || 'Assigned Department' };

  const handleGoToMyDepartment = () => {
    const myChannel = getUserDepartmentChannel(channels, currentUser);
    setActiveConversationId(myChannel);
    setUnauthorizedModalData(null);
  };

  const handleClose = () => {
    setUnauthorizedModalData(null);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md ${
          isDark ? 'bg-[#18181B] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        } border rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all animate-in zoom-in-95 duration-200 cursor-default`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unauthorized-modal-title"
      >
        {/* Top Decorative Alert Banner */}
        <div className="bg-gradient-to-r from-rose-600/20 via-amber-600/20 to-rose-600/20 p-6 border-b border-rose-500/20 flex flex-col items-center text-center relative">
          <button
            type="button"
            onClick={handleClose}
            className={`absolute top-3.5 right-3.5 p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700'
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
            }`}
            title="Close modal (Tap outside to close)"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-13 h-13 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>

          <h3 id="unauthorized-modal-title" className="font-bold text-base tracking-tight text-white">
            You are not authorized to access this
          </h3>
          <p className="text-xs text-rose-400/90 font-mono font-medium mt-1">
            Role-Based Access Control (RBAC) Locked
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
            {unauthorizedModalData.reason || (
              <>
                Department channels are strictly isolated. Your profile is assigned to{' '}
                <strong className="text-blue-400 font-semibold">{userTeamMeta.name}</strong>. Access to{' '}
                <strong className="text-rose-400 font-semibold">{requestedTeamName}</strong> is restricted exclusively to members of {requestedTeamName} and Main Admin (CEO).
              </>
            )}
          </p>

          {/* Access Status Summary Box */}
          <div
            className={`p-3.5 rounded-xl border ${
              isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
            } space-y-2 text-xs font-mono`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Your User:</span>
              <span className="font-semibold text-slate-200">
                {currentUser.name} (@{currentUser.handle})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Assigned Team:</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {userTeamMeta.name}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="text-slate-400">Target Channel:</span>
              <span className="font-semibold text-rose-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                {requestedTeamName} (Locked)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={`p-4 border-t ${
            isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-100 bg-slate-50'
          } flex items-center justify-end gap-2.5`}
        >
          <button
            onClick={handleClose}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              isDark
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleGoToMyDepartment}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span>Go to {userTeamMeta.name}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
