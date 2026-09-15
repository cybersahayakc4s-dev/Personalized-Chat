import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { TeamBadge, RoleBadge } from '../common/Badge';
import { TEAMS_META } from '../../data/initialData';
import { X, Mail, AtSign, Calendar, MessageSquare, Shield, Briefcase, User, LogOut } from 'lucide-react';

export const UserProfileModal: React.FC = () => {
  const {
    profileModalUser,
    setProfileModalUser,
    currentUser,
    createOrOpenDm,
    logout,
    users = [],
    theme
  } = useChat() as any;

  if (!profileModalUser) return null;

  const isDark = theme !== 'nordic';
  const teamMeta = TEAMS_META[profileModalUser.team] || { name: profileModalUser.team || 'General', bg: 'from-blue-600 to-indigo-600' };
  const isMe = profileModalUser.id === currentUser?.id;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setProfileModalUser(null);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md ${
          isDark ? 'bg-[#0B111E] border-[#1E293B] text-slate-200' : 'bg-white border-slate-200 text-slate-900'
        } border rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all max-h-[90vh] cursor-default`}
      >
        
        {/* Modal Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDark ? 'border-[#1E293B] bg-[#0E1626]' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <h2 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              User Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setProfileModalUser(null)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
            }`}
            title="Close profile (Tap outside to close)"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Avatar & Header Summary */}
          <div className="flex items-center gap-3.5 pb-2">
            <Avatar user={profileModalUser} size="lg" showStatus={true} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-bold text-base tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {profileModalUser.name}
                </h3>
                {profileModalUser.role === 'main_admin' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                    CEO
                  </span>
                )}
                {profileModalUser.is_team_leader && profileModalUser.role !== 'main_admin' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    Lead
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {profileModalUser.title || 'Platform Member'}
              </p>
            </div>
          </div>

          {/* Profile Form Grid */}
          <div className="space-y-2.5">
            {/* Tag / Handle */}
            <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
              isDark ? 'bg-[#131B2E] border-[#1E293B]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <AtSign className="w-3.5 h-3.5 text-blue-400" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>User Tag:</span>
              </div>
              <span className={`text-xs font-mono font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                @{profileModalUser.handle}
              </span>
            </div>

            {/* Name */}
            <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
              isDark ? 'bg-[#131B2E] border-[#1E293B]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Full Name:</span>
              </div>
              <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {profileModalUser.name}
              </span>
            </div>

            {/* Designation */}
            <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
              isDark ? 'bg-[#131B2E] border-[#1E293B]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Designation:</span>
              </div>
              <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {profileModalUser.title || 'Member'}
              </span>
            </div>

            {/* Team / Department */}
            <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
              isDark ? 'bg-[#131B2E] border-[#1E293B]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Department / Team:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {teamMeta.name}
                </span>
                <TeamBadge team={profileModalUser.team} size="sm" />
              </div>
            </div>

            {/* Email */}
            <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
              isDark ? 'bg-[#131B2E] border-[#1E293B]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email:</span>
              </div>
              <span className={`text-xs font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {profileModalUser.email}
              </span>
            </div>
          </div>

          {/* If viewing another colleague: Message Button */}
          {!isMe && (
            <div className="pt-2">
              <button
                onClick={() => {
                  createOrOpenDm(profileModalUser.id);
                  setProfileModalUser(null);
                }}
                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send Direct Message</span>
              </button>
            </div>
          )}

          {/* If viewing own profile: Sign Out */}
          {isMe && (
            <div className={`pt-3 border-t space-y-3 ${isDark ? 'border-[#1E293B]' : 'border-slate-100'}`}>
              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  logout();
                  setProfileModalUser(null);
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-rose-500 transition cursor-pointer ${
                  isDark ? 'hover:bg-rose-500/10 border border-rose-500/20' : 'hover:bg-rose-50 border border-rose-200'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
