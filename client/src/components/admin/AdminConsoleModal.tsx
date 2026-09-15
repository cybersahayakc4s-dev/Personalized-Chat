import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { TeamId, ChannelType } from '../../types';
import { TEAMS_META } from '../../data/initialData';
import { TeamBadge, RoleBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import {
  Shield,
  Users,
  Hash,
  Activity,
  Settings,
  X,
  Plus,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  RotateCcw,
  Lock,
  Search,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  Edit2,
  RefreshCw,
  MoreVertical,
  Trash2,
  UserX,
  UserCheck
} from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { api } from '../../services/api';


export const AdminConsoleModal: React.FC = () => {
  const {
    adminModalOpen,
    setAdminModalOpen,
    currentUser,
    users,
    channels,
    auditLogs,
    settings,
    updateSettings,
    createUser,
    toggleUserActive,
    deleteUser,
    createChannel,
    archiveChannel,
    resetWorkspaceData,
    theme,
    addToast
  } = useChat() as any;

  const [activeTab, setActiveTab] = useState<'users' | 'channels' | 'audit' | 'settings'>('users');
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Main-Admins Panel State
  const [mainAdmins, setMainAdmins] = useState<any[]>([]);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserHandle, setNewUserHandle] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTeam, setNewUserTeam] = useState<TeamId>('team_ai');
  const [newUserTitle, setNewUserTitle] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [newUserAccountRole, setNewUserAccountRole] = useState<'employee' | 'main_admin'>('employee');
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; pass: string; handle: string } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [userCreatedSuccess, setUserCreatedSuccess] = useState(false);
  const [userCreateError, setUserCreateError] = useState<string | null>(null);

  // Authorize Main-Admin Provisioning Modal State
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPasswordForCreate, setAdminPasswordForCreate] = useState('');
  const [showAdminPasswordForCreate, setShowAdminPasswordForCreate] = useState(false);
  const [adminCreateError, setAdminCreateError] = useState<string | null>(null);
  const [isAuthorizingAdminCreate, setIsAuthorizingAdminCreate] = useState(false);

  const fetchMainAdmins = async () => {
    try {
      const data = await api.getMainAdmins();
      if (Array.isArray(data)) {
        setMainAdmins(data);
      }
    } catch (err) {
      console.warn('Failed to fetch main admins:', err);
    }
  };

  useEffect(() => {
    if (adminModalOpen) {
      fetchMainAdmins();
    }
  }, [adminModalOpen, users]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(pwd);
  };

  const handleNameChange = (val: string) => {
    setNewUserName(val);
    const autoHandle = val.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
    if (!newUserHandle || newUserHandle === newUserName.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')) {
      setNewUserHandle(autoHandle);
    }
  };

  // New Channel Form State
  const [newChanName, setNewChanName] = useState('');
  const [newChanDesc, setNewChanDesc] = useState('');
  const [newChanType, setNewChanType] = useState<ChannelType>('team');
  const [newChanTeam, setNewChanTeam] = useState<TeamId>('team_ai');
  const [newChanTopic, setNewChanTopic] = useState('');
  const [chanCreatedSuccess, setChanCreatedSuccess] = useState(false);

  // Audit Search
  const [auditSearch, setAuditSearch] = useState('');

  // User Edit State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editTeam, setEditTeam] = useState<TeamId>('team_ai');
  const [editIsTeamLeader, setEditIsTeamLeader] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showTeamChangeConfirm, setShowTeamChangeConfirm] = useState(false);

  // Password Reset State
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [adminPasswordForReset, setAdminPasswordForReset] = useState('');
  const [showAdminPasswordForReset, setShowAdminPasswordForReset] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState<{ user: any; password: string } | null>(null);
  const [copiedResetPassword, setCopiedResetPassword] = useState(false);

  // Reset Seed State
  const [showResetSeedConfirm, setShowResetSeedConfirm] = useState(false);
  const [isResettingSeed, setIsResettingSeed] = useState(false);

  // Three-dot User Menu & Deletion State
  const [actionMenu, setActionMenu] = useState<{
    user: any;
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const handleToggleActionMenu = (e: React.MouseEvent<HTMLButtonElement>, user: any) => {
    e.stopPropagation();
    if (actionMenu?.user.id === user.id) {
      setActionMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 115;
    const showAbove = spaceBelow < menuHeight;

    setActionMenu({
      user,
      top: showAbove ? undefined : rect.bottom + 6,
      bottom: showAbove ? window.innerHeight - rect.top + 6 : undefined,
      right: window.innerWidth - rect.right,
    });
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setIsDeletingUser(true);
    setDeleteUserError(null);
    try {
      const res = await deleteUser(deleteTargetUser.id);
      if (!res?.success) {
        const errMsg = res?.error || 'Failed to delete user account.';
        setDeleteUserError(errMsg);
        if (addToast) {
          addToast({
            type: 'error',
            title: 'Deletion Failed',
            message: errMsg
          });
        }
        return;
      }
      setDeleteTargetUser(null);
      setActionMenu(null);
      setDeleteUserError(null);
      fetchMainAdmins();
      if (addToast) {
        addToast({
          type: 'success',
          title: 'User Deleted',
          message: `User ${deleteTargetUser.name} has been deleted.`
        });
      }
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      const errMsg = err?.message || 'Failed to delete user.';
      setDeleteUserError(errMsg);
      if (addToast) {
        addToast({
          type: 'error',
          title: 'Deletion Failed',
          message: errMsg
        });
      }
    } finally {
      setIsDeletingUser(false);
    }
  };

  if (!adminModalOpen) return null;

  // Strict RBAC Guard: If non-admin attempts to open, dismiss immediately
  if (currentUser.role !== 'main_admin') {
    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) setAdminModalOpen(false);
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 cursor-pointer animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-6 rounded-2xl bg-slate-900 border border-rose-500/40 text-center max-w-sm cursor-default shadow-2xl"
        >
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="font-heading font-bold text-slate-100">Access Denied</h3>
          <p className="text-xs text-slate-400 mt-1">
            Only Main-Admin (`admin`) has administrative authority to access the console.
          </p>
          <button
            onClick={() => setAdminModalOpen(false)}
            className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserCreateError(null);
    if (!newUserName || !newUserHandle || !newUserEmail) return;

    if (newUserAccountRole === 'main_admin') {
      setAdminPasswordForCreate('');
      setShowAdminPasswordForCreate(false);
      setAdminCreateError(null);
      setShowAdminAuthModal(true);
      return;
    }

    await executeProvisionUser(false);
  };

  const executeProvisionUser = async (isMainAdmin: boolean, currentAdminPassword?: string) => {
    const pass = newUserPassword.trim();
    if (!pass) {
      const errorMsg = 'Password is required to provision an account.';
      if (isMainAdmin) {
        setAdminCreateError(errorMsg);
      } else {
        setUserCreateError(errorMsg);
      }
      return;
    }
    setIsAuthorizingAdminCreate(true);
    setAdminCreateError(null);
    const res = await createUser({
      name: newUserName,
      handle: newUserHandle,
      email: newUserEmail,
      team: newUserTeam,
      title: newUserTitle || (isMainAdmin ? 'Main-Admin / Executive' : 'Team Member'),
      password: pass,
      is_team_leader: isTeamLeader,
      is_main_admin: isMainAdmin,
      current_admin_password: currentAdminPassword
    });
    setIsAuthorizingAdminCreate(false);

    if (res && res.success) {
      setCreatedCredentials({
        name: newUserName,
        email: newUserEmail,
        handle: newUserHandle,
        pass: pass
      });
      setUserCreatedSuccess(true);
      setUserCreateError(null);
      setShowAdminAuthModal(false);
      setAdminPasswordForCreate('');
      setNewUserName('');
      setNewUserHandle('');
      setNewUserEmail('');
      setNewUserTitle('');
      setNewUserPassword('');
      setIsTeamLeader(false);
      setNewUserAccountRole('employee');
      fetchMainAdmins();
      setTimeout(() => setUserCreatedSuccess(false), 8000);
    } else {
      const errMsg = res?.error || 'Failed to provision user.';
      if (isMainAdmin) {
        setAdminCreateError(errMsg);
      } else {
        setUserCreateError(errMsg);
      }
    }
  };

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName) return;

    const ok = createChannel({
      name: newChanName,
      description: newChanDesc,
      type: newChanType,
      team: newChanType === 'team' ? newChanTeam : undefined,
      topic: newChanTopic
    });

    if (ok) {
      setChanCreatedSuccess(true);
      setNewChanName('');
      setNewChanDesc('');
      setNewChanTopic('');
      setTimeout(() => setChanCreatedSuccess(false), 3000);
    }
  };

  const handleExportBackup = () => {
    const data = {
      users,
      channels,
      settings,
      auditLogs,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personalize-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  // User Edit Handlers
  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditTeam((user.team as TeamId) || 'team_ai');
    setEditIsTeamLeader(Boolean(user.is_team_leader || user.role === 'team_leader'));
    setEditError(null);
  };

  const handleSaveUser = async (forceTeamChange = false) => {
    if (!editingUser) return;
    if (!editName.trim()) {
      setEditError('User name cannot be empty.');
      return;
    }

    if (editingUser.team !== editTeam && !forceTeamChange) {
      setShowTeamChangeConfirm(true);
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      const numericId = String(editingUser.id).replace('usr_', '');
      await api.adminUpdateUser(numericId, {
        name: editName.trim(),
        team: editTeam,
        is_team_leader: editIsTeamLeader
      });
      setShowTeamChangeConfirm(false);
      setEditingUser(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user.');
      setShowTeamChangeConfirm(false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Password Reset Handlers
  const handleOpenResetPassword = (user: any) => {
    setResetTargetUser(user);
    setAdminPasswordForReset('');
    setShowAdminPasswordForReset(false);
    setResetPasswordError(null);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordValue(pwd);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetTargetUser || !newPasswordValue.trim()) return;
    const isTargetAdmin = Boolean(resetTargetUser.is_main_admin || resetTargetUser.role === 'main_admin');
    if (isTargetAdmin && !adminPasswordForReset.trim()) {
      setResetPasswordError('Please enter your current admin password to authorize this reset.');
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordError(null);
    try {
      const numericId = String(resetTargetUser.id).replace('usr_', '');
      await api.adminResetPassword(
        numericId,
        newPasswordValue.trim(),
        isTargetAdmin ? adminPasswordForReset.trim() : undefined
      );
      setRevealedCredentials({
        user: resetTargetUser,
        password: newPasswordValue.trim()
      });
      setCopiedResetPassword(false);
      setResetTargetUser(null);
      setAdminPasswordForReset('');
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setResetPasswordError(err.message || 'Incorrect admin password or authorization failed.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Reset Seed Handler
  const handleConfirmResetSeed = async () => {
    setIsResettingSeed(true);
    try {
      await resetWorkspaceData();
      setShowResetSeedConfirm(false);
      setAdminModalOpen(false);
    } catch (err) {
      console.error('Reset data error:', err);
      setShowResetSeedConfirm(false);
    } finally {
      setIsResettingSeed(false);
    }
  };

  const isDark = theme === 'slate';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setAdminModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'} border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-colors cursor-default`}
      >
        {/* Modal Header */}
        <div className={`p-4 border-b ${isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-200 bg-slate-50/80'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base">
                  Admin Console
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
                  CEO / Main-Admin
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                Workspace identity provisioning & governance • Operator: {currentUser.name} (@{currentUser.handle})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdminModalOpen(false)}
            className={`p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 active:bg-zinc-700' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200'
            }`}
            title="Close Admin Console (Tap outside to close)"
            aria-label="Close Admin Console"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Always-Visible Main-Admins Governance Bar */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className={`text-xs font-mono font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
              Main-Admins ({mainAdmins.length || 1}):
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(mainAdmins.length > 0 ? mainAdmins : [{ id: currentUser.id, name: currentUser.name, email: currentUser.email }]).map((adm) => (
              <div
                key={adm.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                  adm.id === currentUser?.id || adm.email === currentUser?.email
                    ? isDark
                      ? 'bg-blue-950/50 border-blue-600/50 text-blue-300'
                      : 'bg-blue-100 border-blue-300 text-blue-800'
                    : isDark
                    ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200'
                    : 'bg-white border-slate-300 text-slate-800 shadow-xs'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold">{adm.name}</span>
                <span className="opacity-60 text-[10px]">({adm.email})</span>
                {(adm.id === currentUser?.id || adm.email === currentUser?.email) && (
                  <span className="text-[9px] uppercase px-1 rounded bg-blue-500/20 text-blue-400 font-bold">You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex items-center justify-between gap-1 px-3 sm:px-4 border-b ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-white'} text-xs font-mono`}>
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              User Provisioning ({users.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('channels')}
              className={`flex items-center gap-2 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
                activeTab === 'channels'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              Channels ({channels.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Audit Logs
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : isDark ? 'border-transparent text-zinc-400 hover:text-zinc-200' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Governance
            </button>
          </div>

          {/* Close button on mobile tabs strip */}
          <button
            type="button"
            onClick={() => setAdminModalOpen(false)}
            className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 active:bg-rose-500/20 text-xs font-sans font-medium flex-shrink-0 ml-1 border border-rose-500/20 cursor-pointer"
            title="Close modal"
            aria-label="Close modal"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div
          onScroll={() => { if (actionMenu) setActionMenu(null); }}
          className={`flex-1 overflow-y-auto p-6 space-y-6 ${isDark ? 'bg-zinc-900/50' : 'bg-[#F8F9FA]'}`}
        >
          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Provision User Form */}
              <div className={`p-5 rounded-xl border ${isDark ? 'bg-zinc-950/70 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-sm">
                      Provision New Colleague Account
                    </h3>
                  </div>
                  <span className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    Single-Admin Provisioning
                  </span>
                </div>

                {/* Copied credentials banner */}
                {createdCredentials && (
                  <div className={`mb-4 p-3 rounded-lg border ${
                    isDark ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  } flex items-center justify-between flex-wrap gap-2`}>
                    <div className="text-xs">
                      <div className="font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Account Provisioned: {createdCredentials.name}</span>
                      </div>
                      <div className="font-mono text-[11px] mt-1 space-x-2">
                        <span>Email: <strong>{createdCredentials.email}</strong></span>
                        <span>•</span>
                        <span>Password: <strong className="text-amber-500">{createdCredentials.pass}</strong></span>
                        <span>•</span>
                        <span>Handle: <strong>@{createdCredentials.handle}</strong></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `C4S-Connector Credentials:\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.pass}\nHandle: @${createdCredentials.handle}`
                        );
                        setCopiedCreds(true);
                        setTimeout(() => setCopiedCreds(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCreds ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                    </button>
                  </div>
                )}

                {userCreateError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-between text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      <span className="font-medium">{userCreateError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUserCreateError(null)}
                      className="text-rose-400 hover:text-rose-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                  {/* Account Role Selector */}
                  <div>
                    <label className={`block mb-1.5 font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      Account Role / Privilege Level
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewUserAccountRole('employee')}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          newUserAccountRole === 'employee'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : isDark
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <div>
                          <div className="font-mono text-xs font-semibold">Standard Employee</div>
                          <div className={`text-[10px] ${newUserAccountRole === 'employee' ? 'text-blue-100' : isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                            Assigned to team, standard chat permissions
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewUserAccountRole('main_admin')}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          newUserAccountRole === 'main_admin'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : isDark
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Shield className="w-4 h-4 text-amber-300" />
                        <div>
                          <div className="font-mono text-xs font-semibold">Main-Admin (Co-Admin / CEO)</div>
                          <div className={`text-[10px] ${newUserAccountRole === 'main_admin' ? 'text-amber-100' : isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                            Full executive control (requires sudo password)
                          </div>
                        </div>
                      </button>
                    </div>

                    {newUserAccountRole === 'main_admin' && (
                      <div className="mt-2.5 p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-200">Elevated Workspace Access:</span>
                          <p className="text-[11px] text-amber-300/80 mt-0.5">
                            Main-Admin accounts possess full administrative privileges including user provisioning, password resets, audit log inspection, workspace settings, and system resets. Creating this account requires verifying your current Main-Admin password.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className={`block mb-1 font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={e => handleNameChange(e.target.value)}
                        placeholder="e.g. Danny Vance"
                        required
                        className={`w-full h-9 px-3 rounded-lg border text-xs focus:outline-hidden ${
                          isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`block font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                          Handle (@mention tag)
                        </label>
                        <span className="text-[10px] text-blue-500 font-mono">
                          Colleague @mention in chat
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs">@</span>
                        <input
                          type="text"
                          value={newUserHandle}
                          onChange={e => setNewUserHandle(e.target.value)}
                          placeholder="danny.vance"
                          required
                          className={`w-full h-9 pl-7 pr-3 rounded-lg border text-xs font-mono focus:outline-hidden ${
                            isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block mb-1 font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        Internal Email
                      </label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="danny@company.internal"
                        required
                        className={`w-full h-9 px-3 rounded-lg border text-xs focus:outline-hidden ${
                          isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1 font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        Role / Title
                      </label>
                      <input
                        type="text"
                        value={newUserTitle}
                        onChange={e => setNewUserTitle(e.target.value)}
                        placeholder="e.g. Machine Learning Engineer"
                        className={`w-full h-9 px-3 rounded-lg border text-xs focus:outline-hidden ${
                          isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                        }`}
                      />
                    </div>

                    {/* Password Generator Field */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className={`block font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                          Provisioning Password
                        </label>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-[11px] text-amber-500 hover:text-amber-400 font-medium flex items-center gap-1.5 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>⚡ Generate Secure Password</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          placeholder="Type password or click 'Generate Secure Password'"
                          required
                          className={`w-full h-9 pl-3 pr-10 rounded-lg border text-xs font-mono focus:outline-hidden ${
                            isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Team Tag Selection */}
                  <div>
                    <label className={`block mb-1.5 font-mono text-[11px] ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                      Mandatory Team Tag (Strict 5 Internal Teams Enforced)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {(Object.keys(TEAMS_META) as TeamId[]).map(teamId => {
                        const meta = TEAMS_META[teamId];
                        const isSelected = newUserTeam === teamId;
                        return (
                          <button
                            type="button"
                            key={teamId}
                            onClick={() => setNewUserTeam(teamId)}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : isDark
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-mono text-xs font-semibold">{meta.label}</div>
                            <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                              {meta.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Team Leader Privileges Checkbox */}
                  <div className={`p-3 rounded-lg border flex items-center gap-2.5 ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      id="team_leader_checkbox"
                      checked={isTeamLeader}
                      onChange={e => setIsTeamLeader(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="team_leader_checkbox" className="text-xs cursor-pointer select-none">
                      <span className="font-semibold">Team Leader Privileges:</span> Allows posting operational updates in <span className="font-mono text-blue-500">#updates</span>.
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 shadow-xs transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Provision User Account</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Users Table */}
              <div>
                <h4 className={`font-semibold text-sm mb-2 ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                  Enrolled Colleagues ({users.length})
                </h4>
                <div className={`rounded-xl border overflow-x-auto ${isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-slate-300/80 bg-[#FAFBFD] shadow-xs'}`}>
                  <table className="w-full min-w-[500px] text-left text-xs">
                    <thead className={`border-b text-[11px] font-mono ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-slate-200/70 border-slate-300/80 text-slate-700'}`}>
                      <tr>
                        <th className="p-3 font-semibold">User</th>
                        <th className="p-3 font-semibold">Role</th>
                        <th className="p-3 font-semibold">Team Tag</th>
                        <th className="p-3 font-semibold">Presence</th>
                        <th className="p-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-zinc-800/60' : 'divide-slate-200/80'}`}>
                      {users.map(u => (
                        <tr key={u.id} className={`transition-colors ${isDark ? 'hover:bg-zinc-900/40' : 'hover:bg-slate-100/80'}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar user={u} size="sm" showStatus={false} />
                              <div>
                                <div className={`font-semibold flex items-center gap-1.5 ${isDark ? 'text-zinc-200' : 'text-slate-900'}`}>
                                  <span>{u.name}</span>
                                  {u.account_status === 'deleted' ? (
                                    <span className="text-[9px] px-1 rounded bg-zinc-500/20 text-zinc-400 font-mono">
                                      DELETED
                                    </span>
                                  ) : !u.isActive ? (
                                    <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-400 font-mono">
                                      SUSPENDED
                                    </span>
                                  ) : null}
                                </div>
                                <div className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                  @{u.handle} • {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <RoleBadge role={u.role} size="sm" />
                          </td>
                          <td className="p-3">
                            <TeamBadge team={u.team} size="sm" />
                          </td>
                          <td className={`p-3 font-mono text-[11px] capitalize ${isDark ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                            {u.account_status || u.status}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className={`p-1.5 rounded transition-colors cursor-pointer ${
                                  isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'
                                }`}
                                title="Edit User Name, Team & Role"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(u)}
                                className={`p-1.5 rounded transition-colors cursor-pointer ${
                                  isDark ? 'text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-100/70'
                                }`}
                                title="Reset Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              {u.id !== currentUser.id && u.account_status !== 'deleted' && (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleActionMenu(e, u)}
                                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                                    actionMenu?.user.id === u.id
                                      ? isDark ? 'bg-zinc-800 text-white' : 'bg-slate-200 text-slate-900'
                                      : isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'
                                  }`}
                                  title="More Options"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHANNELS */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              {/* Create Channel Form - Gated by Governance Policy */}
              {settings.allowCustomChannels ? (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <h3 className="font-heading font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-400" />
                    Create Custom Channel
                  </h3>

                  {chanCreatedSuccess && (
                    <div className="mb-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Channel created successfully!
                    </div>
                  )}

                  <form onSubmit={handleCreateChannelSubmit} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-mono text-[11px]">Channel Name</label>
                        <input
                          type="text"
                          value={newChanName}
                          onChange={e => setNewChanName(e.target.value)}
                          placeholder="e.g. infra-benchmarks"
                          required
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-mono text-[11px]">Channel Type</label>
                        <select
                          value={newChanType}
                          onChange={e => setNewChanType(e.target.value as ChannelType)}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
                        >
                          <option value="team">Team Channel (Restricted)</option>
                          <option value="public">Public (All Company)</option>
                          <option value="announcement">Announcement (Admin Broadcast Only)</option>
                        </select>
                      </div>
                    </div>

                    {newChanType === 'team' && (
                      <div>
                        <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                          Target Team (Strict 5 Teams)
                        </label>
                        <select
                          value={newChanTeam}
                          onChange={e => setNewChanTeam(e.target.value as TeamId)}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                        >
                          <option value="team_ai">team_ai (AI Engineering)</option>
                          <option value="team_legal">team_legal (Legal & Compliance)</option>
                          <option value="hr_admin">hr_admin (People Ops Team Tag)</option>
                          <option value="seo">seo (SEO & Growth)</option>
                          <option value="coordination">coordination (Operations & Release)</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-400 mb-1 font-mono text-[11px]">Description & Topic</label>
                      <input
                        type="text"
                        value={newChanDesc}
                        onChange={e => setNewChanDesc(e.target.value)}
                        placeholder="Purpose of this channel..."
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Create Channel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className={`p-5 rounded-xl border ${isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold text-sm ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                        Fixed Organizational Structure
                      </h4>
                      <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                        Custom channel provisioning is currently disabled by governance policy. The workspace operates under the 5 core organizational departments and corporate broadcast feeds (#announcements, #updates).
                      </p>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setActiveTab('settings')}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Enable Custom Channels in Governance Settings</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Channels List */}
              <div className="space-y-2">
                <h4 className="font-heading font-semibold text-sm text-slate-200">
                  Active Channels ({channels.length})
                </h4>
                <div className="space-y-2">
                  {channels.map(chan => (
                    <div
                      key={chan.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{chan.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {chan.type}
                            </span>
                            {chan.team && <TeamBadge team={chan.team} size="sm" />}
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">{chan.description}</p>
                        </div>
                      </div>

                      {chan.id !== 'c-general' && chan.id !== 'c-announcements' && (
                        <button
                          onClick={() => archiveChannel(chan.id)}
                          className="text-rose-400 hover:text-rose-300 font-mono text-xs px-2 py-1 rounded hover:bg-rose-500/10"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-semibold text-sm text-slate-200">
                    Security & RBAC Audit Stream
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Immutable administrative ledger tracking RBAC enforcement and provisioning events.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    placeholder="Filter audit logs..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden font-mono text-[11px]">
                <div className="divide-y divide-slate-800/80">
                  {auditLogs
                    .filter(
                      log =>
                        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.details.toLowerCase().includes(auditSearch.toLowerCase())
                    )
                    .map(log => (
                      <div key={log.id} className="p-3 hover:bg-slate-900/40 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                              {log.action}
                            </span>
                            <span className="text-slate-400">Actor: {log.actorId}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-400">{log.ipAddress}</span>
                          </div>
                          <p className="text-slate-300 mt-1">{log.details}</p>
                        </div>
                        <span className="text-slate-400 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GOVERNANCE & SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h3 className="font-heading font-semibold text-sm text-slate-200">
                  Workspace Governance Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={e => updateSettings({ name: e.target.value })}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                      Mesh Domain
                    </label>
                    <input
                      type="text"
                      value={settings.domain}
                      onChange={e => updateSettings({ domain: e.target.value })}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                      Message Retention Period (Days)
                    </label>
                    <input
                      type="number"
                      value={settings.retentionDays}
                      onChange={e => updateSettings({ retentionDays: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                      Max Attachment Size (MB)
                    </label>
                    <input
                      type="number"
                      value={Math.round(settings.maxUploadSizeBytes / (1024 * 1024))}
                      onChange={e =>
                        updateSettings({ maxUploadSizeBytes: Number(e.target.value) * 1024 * 1024 })
                      }
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-800/80">
                    <label className="block text-slate-400 mb-1 font-mono text-[11px] flex items-center justify-between">
                      <span className="text-slate-200 font-semibold">Server Link / Remote VPS Address</span>
                      <span className="text-[10px] text-slate-500 font-sans">Default: Local Server (http://127.0.0.1:8000)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. http://192.168.1.100:8000 or https://chat.company.com"
                      value={settings.serverUrl || ''}
                      onChange={e => updateSettings({ serverUrl: e.target.value })}
                      className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Configure your VPS domain or IP. All web app and PWA clients will route REST API and real-time Socket.IO events to this address.
                    </p>
                  </div>

                  {/* Custom Channel Provisioning Policy Toggle */}
                  <div className="sm:col-span-2 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <label className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-blue-400" />
                          <span>Allow Custom Channel Provisioning</span>
                        </label>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Allow Main-Admins to create custom project/topic channels in the Channels tab. When disabled, the workspace is strictly scoped to the 5 core departments and system broadcasts.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(settings.allowCustomChannels)}
                          onChange={e => updateSettings({ allowCustomChannels: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export & Reset Actions */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-heading font-semibold text-sm text-slate-200">
                    Data Portability & State Snapshot
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Export full encrypted snapshot or reset local database state.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportBackup}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-2 font-mono"
                  >
                    <FileDown className="w-4 h-4" />
                    Export Backup JSON
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetSeedConfirm(true)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-2 font-mono cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Data to Seed
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingEdit) {
              setEditingUser(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Edit User Profile</h3>
                  <p className="text-[11px] text-slate-400 font-mono">@{editingUser.handle} • {editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={isSavingEdit}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSavingEdit}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors ${
                    isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                  }`}
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">Assigned Team</label>
                <select
                  value={editTeam}
                  onChange={(e) => setEditTeam(e.target.value as TeamId)}
                  disabled={isSavingEdit}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors ${
                    isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                  }`}
                >
                  {Object.entries(TEAMS_META).map(([tId, tMeta]) => (
                    <option key={tId} value={tId}>
                      {tMeta.name} ({tId})
                    </option>
                  ))}
                </select>
                {editingUser.team !== editTeam && (
                  <p className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Team change will close past team channels and migrate live sessions.
                  </p>
                )}
              </div>

              {editingUser.role !== 'main_admin' && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIsTeamLeader}
                      onChange={(e) => setEditIsTeamLeader(e.target.checked)}
                      disabled={isSavingEdit}
                      className="rounded border-zinc-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-300">Grant Team Leader privileges</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 pl-5">
                    Team leaders have moderator authority within their team channels.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/40">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={isSavingEdit}
                className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveUser(false)}
                disabled={isSavingEdit}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Change Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showTeamChangeConfirm}
        title="Confirm Team Reassignment"
        description={
          <div>
            <p>
              Are you sure you want to reassign <span className="font-semibold text-slate-200">{editingUser?.name}</span> from <span className="font-mono text-amber-400">{TEAMS_META[editingUser?.team as TeamId]?.name || editingUser?.team}</span> to <span className="font-mono text-emerald-400">{TEAMS_META[editTeam]?.name || editTeam}</span>?
            </p>
            <p className="mt-2 text-xs text-slate-400">
              This will close access to past team channels, grant access to the new team, and migrate all active live sessions across devices.
            </p>
          </div>
        }
        confirmLabel="Reassign Team"
        cancelLabel="Cancel"
        isLoading={isSavingEdit}
        onConfirm={() => handleSaveUser(true)}
        onCancel={() => setShowTeamChangeConfirm(false)}
      />

      {/* Password Reset Modal */}
      {resetTargetUser && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isResettingPassword) {
              setResetTargetUser(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Reset User Password</h3>
                  <p className="text-[11px] text-slate-400 font-mono">@{resetTargetUser.handle} • {resetTargetUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                disabled={isResettingPassword}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Resetting password for <span className="font-medium text-slate-200">{resetTargetUser.name}</span> will immediately revoke all their active sessions and tokens.
            </p>

            {/* Main-Admin Step-Up Warning Banner & Current Password Field */}
            {Boolean(resetTargetUser.is_main_admin || resetTargetUser.role === 'main_admin') && (
              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-200">Main-Admin Protection (Step-Up Auth)</p>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      You are modifying a Main-Admin account. Re-enter your current password to authorize this password change.
                    </p>
                  </div>
                </div>

                {resetPasswordError && (
                  <div className="p-2.5 rounded-lg border bg-rose-500/10 border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{resetPasswordError}</span>
                    </div>
                    <button type="button" onClick={() => setResetPasswordError(null)} className="text-rose-400 hover:text-rose-200">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    Your Current Admin Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPasswordForReset ? 'text' : 'password'}
                      value={adminPasswordForReset}
                      onChange={(e) => setAdminPasswordForReset(e.target.value)}
                      disabled={isResettingPassword}
                      placeholder="Enter your current admin password"
                      autoFocus
                      className={`w-full px-3 pr-10 py-2 rounded-lg border font-mono text-xs outline-none transition-colors ${
                        isDark ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPasswordForReset(!showAdminPasswordForReset)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showAdminPasswordForReset ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-mono text-[11px]">New Password</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    disabled={isResettingPassword}
                    className={`flex-1 px-3 py-2 rounded-lg border font-mono text-xs outline-none transition-colors ${
                      isDark ? 'bg-zinc-800/80 border-zinc-700 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
                      let pwd = '';
                      for (let i = 0; i < 12; i++) {
                        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setNewPasswordValue(pwd);
                    }}
                    disabled={isResettingPassword}
                    className="px-2.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
                    title="Generate new random password"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/40">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                disabled={isResettingPassword}
                className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                disabled={
                  isResettingPassword ||
                  !newPasswordValue.trim() ||
                  (Boolean(resetTargetUser.is_main_admin || resetTargetUser.role === 'main_admin') && !adminPasswordForReset.trim())
                }
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isResettingPassword ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset & Invalidate Sessions'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismissible Password Reveal Modal */}
      {revealedCredentials && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRevealedCredentials(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Password Reset Complete</h3>
                <p className="text-xs text-slate-400">
                  New password for <span className="font-medium text-slate-200">{revealedCredentials.user.name}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between gap-3 mb-4">
              <span className="font-mono text-base font-semibold text-emerald-400 tracking-wider select-all">
                {revealedCredentials.password}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(revealedCredentials.password);
                  setCopiedResetPassword(true);
                  setTimeout(() => setCopiedResetPassword(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-mono flex items-center gap-1.5 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                {copiedResetPassword ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Share this password securely with <span className="font-semibold">{revealedCredentials.user.name}</span>. It will not be shown again and is never logged in server or client logs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRevealedCredentials(null)}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              Done / Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Authorize Main-Admin Provisioning Modal */}
      {showAdminAuthModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isAuthorizingAdminCreate) {
              setShowAdminAuthModal(false);
              setAdminPasswordForCreate('');
              setAdminCreateError(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Authorize Main-Admin Provisioning</h3>
                <p className="text-xs text-slate-400">Step-Up Authentication Required</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 mb-4 space-y-1">
              <p className="font-semibold text-amber-200">You are creating a new Main-Admin account:</p>
              <div className="font-mono text-[11px] text-amber-100 pl-2">
                <div>• Name: <span className="font-semibold">{newUserName}</span></div>
                <div>• Email: <span className="font-semibold">{newUserEmail}</span></div>
                <div>• Handle: <span className="font-semibold">@{newUserHandle}</span></div>
              </div>
              <p className="text-[10px] text-amber-300/70 pt-1">
                This account will hold full CEO-level administrative privileges over the entire workspace.
              </p>
            </div>

            {adminCreateError && (
              <div className="mb-4 p-2.5 rounded-lg border bg-rose-500/10 border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{adminCreateError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminCreateError(null)}
                  className="text-rose-400 hover:text-rose-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                  Your Current Admin Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPasswordForCreate ? 'text' : 'password'}
                    value={adminPasswordForCreate}
                    onChange={(e) => setAdminPasswordForCreate(e.target.value)}
                    disabled={isAuthorizingAdminCreate}
                    placeholder="Enter your current password"
                    autoFocus
                    className={`w-full px-3 pr-10 py-2 rounded-lg border font-mono text-xs outline-none transition-colors ${
                      isDark ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPasswordForCreate(!showAdminPasswordForCreate)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showAdminPasswordForCreate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/40">
              <button
                type="button"
                onClick={() => {
                  setShowAdminAuthModal(false);
                  setAdminPasswordForCreate('');
                  setAdminCreateError(null);
                }}
                disabled={isAuthorizingAdminCreate}
                className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeProvisionUser(true, adminPasswordForCreate)}
                disabled={isAuthorizingAdminCreate || !adminPasswordForCreate.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isAuthorizingAdminCreate ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Authorizing...
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    Authorize & Provision Admin
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Seed Confirm Dialog */}
      <ConfirmDialog
        isOpen={showResetSeedConfirm}
        title="Reset Workspace Data to Seed"
        description="Are you sure you want to reset all workspace data to seed state? This will delete all chat messages, reactions, receipts, and file attachments from the server database. All existing user accounts will remain intact. This action cannot be undone."
        confirmLabel="Reset Everything"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isResettingSeed}
        onConfirm={handleConfirmResetSeed}
        onCancel={() => setShowResetSeedConfirm(false)}
      />

      {/* Delete User Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTargetUser)}
        title="Delete & Archive User Account"
        description={
          deleteTargetUser ? (
            <div className="space-y-3">
              <p>
                Are you sure you want to delete <strong className={isDark ? 'text-white' : 'text-slate-900'}>{deleteTargetUser.name}</strong> (@{deleteTargetUser.handle})? Their account credentials and sessions will be permanently revoked. Historical messages will be preserved as '[Deleted User]'. This action cannot be undone.
              </p>
              {deleteUserError && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{deleteUserError}</span>
                </div>
              )}
            </div>
          ) : ''
        }
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeletingUser}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => {
          setDeleteTargetUser(null);
          setDeleteUserError(null);
        }}
      />

      {/* Floating Action Menu for User Table (Rendered outside overflow containers) */}
      {actionMenu && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={(e) => {
              e.stopPropagation();
              setActionMenu(null);
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: actionMenu.top,
              bottom: actionMenu.bottom,
              right: actionMenu.right,
              zIndex: 65,
            }}
            className={`w-48 rounded-xl border shadow-2xl py-1.5 font-sans text-xs animate-in fade-in zoom-in-95 duration-100 ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-slate-200 text-slate-800 shadow-slate-300/60'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleUserActive(actionMenu.user.id);
                setActionMenu(null);
              }}
              className={`w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-medium ${
                isDark
                  ? actionMenu.user.isActive
                    ? 'text-amber-400 hover:bg-amber-500/10'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                  : actionMenu.user.isActive
                  ? 'text-amber-700 hover:bg-amber-50'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {actionMenu.user.isActive ? (
                <>
                  <UserX className="w-4 h-4 shrink-0" />
                  <span>Suspend Account</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Reactivate Account</span>
                </>
              )}
            </button>

            <div className={`my-1 border-t ${isDark ? 'border-zinc-800' : 'border-slate-100'}`} />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteUserError(null);
                setDeleteTargetUser(actionMenu.user);
                setActionMenu(null);
              }}
              className={`w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-medium ${
                isDark
                  ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                  : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Delete Account</span>
            </button>
          </div>
        </>
      )}

    </div>
  );
};
