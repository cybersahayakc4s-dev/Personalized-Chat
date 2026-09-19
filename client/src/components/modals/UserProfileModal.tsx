import React, { useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { TEAMS_META } from '../../data/initialData';
import { getUserColorProfile, getUserNameColor } from '../../utils/userColors';
import { api, getServerBaseUrl } from '../../services/api';
import {
  X,
  Mail,
  AtSign,
  MessageSquare,
  Shield,
  Briefcase,
  LogOut,
  Copy,
  Check,
  Circle,
  Camera,
  Loader2,
  Trash2
} from 'lucide-react';

export const UserProfileModal: React.FC = () => {
  const {
    profileModalUser,
    setProfileModalUser,
    currentUser,
    createOrOpenDm,
    logout
  } = useChat() as any;

  const [copiedHandle, setCopiedHandle] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!profileModalUser) return null;

  const isMe = profileModalUser.id === currentUser?.id;
  const teamMeta = TEAMS_META[profileModalUser.team as keyof typeof TEAMS_META] || {
    name: profileModalUser.team || 'General Workspace',
    description: 'Workspace Member'
  };

  const bannerUrl = (() => {
    const raw = profileModalUser.banner_url;
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('blob:') || raw.startsWith('data:')) {
      return raw;
    }
    const base = getServerBaseUrl();
    return base ? `${base}${raw}` : raw;
  })();

  const handleBannerFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setBannerError(null);
    try {
      const updated = await api.uploadBanner(file);
      if (updated && updated.banner_url) {
        setProfileModalUser((prev: any) => prev ? { ...prev, banner_url: updated.banner_url } : prev);
      }
    } catch (err: any) {
      setBannerError(err.message || 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleRemoveBanner = async () => {
    setUploadingBanner(true);
    setBannerError(null);
    try {
      await api.removeBanner();
      setProfileModalUser((prev: any) => prev ? { ...prev, banner_url: null } : prev);
    } catch (err: any) {
      setBannerError(err.message || 'Failed to remove banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const userPalette = getUserColorProfile(profileModalUser.id, profileModalUser.name);
  const userNameColor = getUserNameColor(profileModalUser.id, profileModalUser.name);

  // User post/designation
  const userPost = profileModalUser.title ||
    (profileModalUser.role === 'main_admin'
      ? 'Chief Executive Officer'
      : profileModalUser.role === 'team_leader'
      ? `${teamMeta.name} Lead`
      : `${teamMeta.name} Specialist`);

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(`@${profileModalUser.handle}`);
    setCopiedHandle(true);
    setTimeout(() => setCopiedHandle(false), 2000);
  };

  const isOnline = profileModalUser.status === 'online';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setProfileModalUser(null);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-subtle text-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all max-h-[90vh] cursor-default"
      >
        {/* Profile Card Header (Banner + Overlapping Avatar, never clipped) */}
        <div className="relative shrink-0 select-none">
          {/* Top Banner */}
          <div
            className="h-28 bg-gradient-to-r from-surface-hover via-surface to-surface-hover border-b border-subtle relative overflow-hidden bg-cover bg-center"
            style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
          >
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px]" />

            {/* Top Right Close Button */}
            <button
              type="button"
              onClick={() => setProfileModalUser(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xs transition cursor-pointer z-20"
              title="Close profile"
              aria-label="Close profile"
            >
              <X className="w-4 h-4" />
            </button>

            {/* If own profile, show Change Banner / Remove Banner controls */}
            {isMe && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                <input
                  type="file"
                  ref={bannerInputRef}
                  onChange={handleBannerFileSelected}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  className="px-2.5 py-1 rounded-full bg-black/50 hover:bg-black/70 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-xs transition cursor-pointer disabled:opacity-50 border border-white/20 shadow-xs"
                  title="Upload custom banner image"
                >
                  {uploadingBanner ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3 h-3" />
                      <span>{profileModalUser.banner_url ? 'Change Banner' : 'Upload Banner'}</span>
                    </>
                  )}
                </button>

                {profileModalUser.banner_url && !uploadingBanner && (
                  <button
                    type="button"
                    onClick={handleRemoveBanner}
                    className="p-1 rounded-full bg-black/50 hover:bg-black/70 text-white/80 hover:text-danger backdrop-blur-xs transition cursor-pointer border border-white/20 shadow-xs"
                    title="Remove custom banner"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Overlapping Avatar & Action Bar */}
          <div className="px-6 flex items-end justify-between -mt-10 relative z-10">
            <div className="p-1 rounded-full bg-surface shadow-lg ring-4 ring-surface">
              <Avatar user={profileModalUser} size="xl" showStatus={true} />
            </div>

            {!isMe && (
              <button
                type="button"
                onClick={() => {
                  createOrOpenDm(profileModalUser.id);
                  setProfileModalUser(null);
                }}
                className="h-9 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer mb-1"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Direct Message</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Content Body (begins below avatar with clean spacing) */}
        <div className="px-6 pb-6 pt-3 overflow-y-auto flex-1">
          {bannerError && (
            <div className="mb-3 p-2.5 rounded-lg bg-surface-hover border border-subtle text-danger text-xs flex items-center justify-between">
              <span>{bannerError}</span>
              <button type="button" onClick={() => setBannerError(null)} className="text-secondary hover:text-primary cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* User Name & Post / Designation */}
          <div className="mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="font-bold text-xl tracking-tight"
                style={{ color: userNameColor }}
              >
                {profileModalUser.name}
              </h2>
              {isMe && (
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-surface-hover text-accent border border-subtle font-medium">
                  You
                </span>
              )}
              {profileModalUser.role === 'main_admin' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-accent-muted text-accent font-semibold border border-subtle">
                  CEO / Admin
                </span>
              )}
            </div>

            {/* Prominent Post / Designation */}
            <p className="text-xs font-medium text-secondary mt-0.5">
              {userPost}
            </p>

            {/* Handle & Online Status Indicator */}
            <div className="flex items-center gap-3 text-xs text-muted mt-2">
              <button
                type="button"
                onClick={handleCopyHandle}
                className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer group"
                title="Copy handle"
              >
                <span>@{profileModalUser.handle}</span>
                {copiedHandle ? (
                  <Check className="w-3 h-3 text-accent" />
                ) : (
                  <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                )}
              </button>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-primary ring-2 ring-primary/20' : 'bg-muted'}`} />
                <span className="capitalize">{profileModalUser.status || 'Offline'}</span>
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-2 pt-2 border-t border-subtle">
            {/* Department / Team */}
            <div className="p-3 rounded-lg border border-subtle bg-surface-hover/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-secondary">
                <Briefcase className="w-4 h-4 text-accent" />
                <span>Department</span>
              </div>
              <span className="text-xs font-semibold text-primary">
                {teamMeta.name}
              </span>
            </div>

            {/* Corporate Email */}
            <div className="p-3 rounded-lg border border-subtle bg-surface-hover/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-secondary">
                <Mail className="w-4 h-4 text-accent" />
                <span>Email</span>
              </div>
              <span className="text-xs font-mono text-primary select-all truncate max-w-56">
                {profileModalUser.email || `${profileModalUser.handle}@internal.corp`}
              </span>
            </div>

            {/* Access Role */}
            <div className="p-3 rounded-lg border border-subtle bg-surface-hover/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-secondary">
                <Shield className="w-4 h-4 text-accent" />
                <span>Role</span>
              </div>
              <span className="text-xs font-mono font-medium text-primary capitalize">
                {profileModalUser.role === 'main_admin' ? 'Main Admin (CEO)' : profileModalUser.role === 'team_leader' ? 'Team Leader' : 'Employee'}
              </span>
            </div>
          </div>

          {/* Sign Out Action (Viewing own profile) */}
          {isMe && (
            <div className="pt-4 mt-4 border-t border-subtle">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setProfileModalUser(null);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-danger hover:bg-surface-hover border border-subtle transition cursor-pointer"
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
