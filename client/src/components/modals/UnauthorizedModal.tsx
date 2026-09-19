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

  const isDark = theme !== 'light';
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
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all animate-in zoom-in-95 duration-200 cursor-default"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unauthorized-modal-title"
      >
        {/* Top Decorative Alert Banner */}
        <div className="bg-surface p-6 border-b border-subtle flex flex-col items-center text-center relative">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3.5 right-3.5 p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-secondary hover:text-primary hover:bg-surface-hover"
            title="Close"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-surface-hover border border-subtle flex items-center justify-center text-danger mb-3 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>

          <h3 id="unauthorized-modal-title" className="font-bold text-base tracking-tight text-primary">
            You are not authorized to access this
          </h3>
          <p className="text-xs text-danger font-mono font-medium mt-1">
            Role-Based Access Control (RBAC) Locked
          </p>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs leading-relaxed text-secondary">
            {unauthorizedModalData.reason || (
              <>
                Department channels are strictly isolated. Your profile is assigned to{' '}
                <strong className="text-primary font-semibold">{userTeamMeta.name}</strong>. Access to{' '}
                <strong className="text-primary font-semibold">{requestedTeamName}</strong> is restricted exclusively to members of {requestedTeamName} and Main Admin.
              </>
            )}
          </p>

          {/* Access Status Summary Box */}
          <div
            className="p-3.5 rounded-xl border bg-surface-hover border-subtle space-y-2 text-xs font-mono"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted">Your User:</span>
              <span className="font-semibold text-primary">
                {currentUser.name} (@{currentUser.handle})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Assigned Team:</span>
              <span className="font-semibold text-primary flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                {userTeamMeta.name}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-subtle pt-2">
              <span className="text-muted">Target Channel:</span>
              <span className="font-semibold text-danger flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-danger" />
                {requestedTeamName} (Locked)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="p-4 border-t border-subtle bg-surface flex items-center justify-end gap-2.5"
        >
          <button
            onClick={handleClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleGoToMyDepartment}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>Go to {userTeamMeta.name}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
