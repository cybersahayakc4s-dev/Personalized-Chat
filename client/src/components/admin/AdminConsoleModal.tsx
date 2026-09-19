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
          className="p-6 rounded-2xl bg-canvas border border-danger/40 text-center max-w-sm cursor-default shadow-2xl"
        >
          <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2" />
          <h3 className="font-heading font-bold text-primary">Access Denied</h3>
          <p className="text-xs text-muted mt-1">
            Only Main-Admin (`admin`) has administrative authority to access the console.
          </p>
          <button
            onClick={() => setAdminModalOpen(false)}
            className="mt-4 px-4 py-1.5 rounded-lg bg-surface-hover text-xs text-secondary hover:bg-surface-hover cursor-pointer"
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
        pass: 'pass'
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

  const isDark = theme !== 'light';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setAdminModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] bg-surface border-subtle text-primary border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-colors cursor-default"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-subtle bg-canvas flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/30 text-accent flex items-center justify-center text-accent">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base">
                  Admin Console
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-accent-muted text-accent border border-accent/20 font-medium">
                  CEO / Main-Admin
                </span>
              </div>
              <p className="text-xs text-muted">
                Workspace identity provisioning & governance • Operator: {currentUser.name} (@{currentUser.handle})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdminModalOpen(false)}
            className="p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer text-secondary hover:text-primary hover:bg-surface-hover"
            title="Close Admin Console (Tap outside to close)"
            aria-label="Close Admin Console"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Always-Visible Main-Admins Governance Bar */}
        <div className="px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 bg-canvas border-subtle">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-secondary shrink-0" />
            <span className="text-xs font-mono font-semibold text-secondary">
              Main-Admins ({mainAdmins.length || 1}):
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(mainAdmins.length > 0 ? mainAdmins : [{ id: currentUser.id, name: currentUser.name, email: currentUser.email }]).map((adm) => (
              <div
                key={adm.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                  adm.id === currentUser?.id || adm.email === currentUser?.email
                    ? 'bg-accent-muted border-accent/40 text-accent'
                    : 'bg-accent-muted border-accent/40 text-accent'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold">{adm.name}</span>
                <span className="opacity-60 text-xs">({adm.email})</span>
                {(adm.id === currentUser?.id || adm.email === currentUser?.email) && (
                  <span className="text-xs uppercase px-1 rounded bg-accent-muted text-accent font-semibold">You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between gap-1 px-3 sm:px-4 border-b border-subtle bg-surface text-xs font-mono">
          <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
                activeTab === 'users'
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-secondary hover:text-primary'
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
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-secondary hover:text-primary'
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
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-secondary hover:text-primary'
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
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-secondary hover:text-primary'
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
            className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-danger/10 text-danger active:bg-danger/20 text-xs font-sans font-medium flex-shrink-0 ml-1 border border-danger/20 cursor-pointer"
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
          className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]"
        >
          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Provision User Form */}
              <div className="p-5 rounded-xl border bg-canvas border-subtle">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-accent" />
                    <h3 className="font-semibold text-sm">
                      Provision New Colleague Account
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-muted">
                    Single-Admin Provisioning
                  </span>
                </div>

                {/* Copied credentials banner */}
                {createdCredentials && (
                  <div className="mb-4 p-3 rounded-lg border bg-accent-muted border-accent/40 text-accent flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs">
                      <div className="font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        <span>Account Provisioned: {createdCredentials.name}</span>
                      </div>
                      <div className="font-mono text-xs mt-1 space-x-2">
                        <span>Email: <strong>{createdCredentials.email}</strong></span>
                        <span>•</span>
                        <span>Password: <strong className="text-secondary">{createdCredentials.pass}</strong></span>
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
                      className="px-3 py-1.5 rounded-md bg-accent text-white hover:opacity-90 text-xs font-medium flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCreds ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                    </button>
                  </div>
                )}

                {userCreateError && (
                  <div className="mb-4 p-3 rounded-xl bg-danger-muted border border-danger/30 text-danger flex items-center justify-between text-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
                      <span className="font-medium">{userCreateError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUserCreateError(null)}
                      className="text-danger hover:underline"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
                  {/* Account Role Selector */}
                  <div>
                    <label className="block mb-1.5 font-mono text-xs text-muted">
                      Account Role / Privilege Level
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewUserAccountRole('employee')}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          newUserAccountRole === 'employee'
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-surface-hover border-subtle text-secondary hover:border-focus'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <div>
                          <div className="font-mono text-xs font-semibold">Standard Employee</div>
                          <div className={`text-xs ${newUserAccountRole === 'employee' ? 'text-white' : 'text-muted'}`}>
                            Assigned to team, standard chat permissions
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewUserAccountRole('main_admin')}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          newUserAccountRole === 'main_admin'
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-surface-hover border-subtle text-secondary hover:border-focus'
                        }`}
                      >
                        <Shield className="w-4 h-4 text-secondary" />
                        <div>
                          <div className="font-mono text-xs font-semibold">Main-Admin (Co-Admin / CEO)</div>
                          <div className={`text-xs ${newUserAccountRole === 'main_admin' ? 'text-primary' : 'text-muted'}`}>
                            Full executive control (requires sudo password)
                          </div>
                        </div>
                      </button>
                    </div>

                    {newUserAccountRole === 'main_admin' && (
                      <div className="mt-2.5 p-3 rounded-lg border bg-accent/10 border-accent/30 flex items-start gap-2 text-xs text-secondary">
                        <AlertTriangle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-primary font-semibold">Elevated Workspace Access:</span>
                          <p className="text-xs text-secondary/80 mt-0.5">
                            Main-Admin accounts possess full administrative privileges including user provisioning, password resets, audit log inspection, workspace settings, and system resets. Creating this account requires verifying your current Main-Admin password.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block mb-1 font-mono text-xs text-muted">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={e => handleNameChange(e.target.value)}
                        placeholder="e.g. Danny Vance"
                        required
                        className="w-full h-9 px-3 rounded-lg border text-xs focus:outline-hidden bg-surface border-subtle text-primary focus:border-accent"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-mono text-xs text-muted">
                          Handle (@mention tag)
                        </label>
                        <span className="text-xs text-accent font-mono">
                          Colleague @mention in chat
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted font-mono text-xs">@</span>
                        <input
                          type="text"
                          value={newUserHandle}
                          onChange={e => setNewUserHandle(e.target.value)}
                          placeholder="danny.vance"
                          required
                          className="w-full h-9 pl-7 pr-3 rounded-lg border text-xs font-mono focus:outline-hidden bg-surface border-subtle text-primary focus:border-accent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 font-mono text-xs text-muted">
                        Internal Email
                      </label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="danny@company.internal"
                        required
                        className="w-full h-9 px-3 rounded-lg border text-xs focus:outline-hidden bg-surface border-subtle text-primary focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-mono text-xs text-muted">
                        Role / Title
                      </label>
                      <input
                        type="text"
                        value={newUserTitle}
                        onChange={e => setNewUserTitle(e.target.value)}
                        placeholder="e.g. Machine Learning Engineer"
                        className="w-full h-9 px-3 rounded-lg border text-xs focus:outline-hidden bg-surface border-subtle text-primary focus:border-accent"
                      />
                    </div>

                    {/* Password Generator Field */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-mono text-xs text-muted">
                          Provisioning Password
                        </label>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-xs text-accent hover:underline font-medium flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Generate Secure Password</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          placeholder="Type password or click 'Generate Secure Password'"
                          required
                          className="w-full h-9 pl-3 pr-10 rounded-lg border text-xs font-mono focus:outline-hidden bg-surface border-subtle text-primary focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-muted hover:text-secondary dark:hover:text-secondary"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Team Tag Selection */}
                  <div>
                    <label className="block mb-1.5 font-mono text-xs text-muted">
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
                                ? 'bg-accent text-white border-accent shadow-xs'
                                : 'bg-surface-hover border-subtle text-secondary hover:border-focus'
                            }`}
                          >
                            <div className="font-mono text-xs font-semibold">{meta.label}</div>
                            <div className={`text-xs truncate mt-0.5 ${isSelected ? 'text-white' : 'text-muted'}`}>
                              {meta.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Team Leader Privileges Checkbox */}
                  <div className="p-3 rounded-lg border flex items-center gap-2.5 bg-secondary-900 border-subtle">
                    <input
                      type="checkbox"
                      id="team_leader_checkbox"
                      checked={isTeamLeader}
                      onChange={e => setIsTeamLeader(e.target.checked)}
                      className="w-4 h-4 rounded border-subtle text-accent focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="team_leader_checkbox" className="text-xs cursor-pointer select-none">
                      <span className="font-semibold">Team Leader Privileges:</span> Allows posting operational updates in <span className="font-mono text-accent">#updates</span>.
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 font-medium flex items-center gap-2 shadow-xs transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Provision User Account</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Users Table */}
              <div>
                <h4 className="font-semibold text-sm mb-2 text-secondary">
                  Enrolled Colleagues ({users.length})
                </h4>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-x-auto shadow-xs">
                  <table className="w-full min-w-[500px] text-left text-xs">
                    <thead className="border-b text-xs font-mono bg-surface border-subtle text-muted">
                      <tr>
                        <th className="p-3 font-semibold">User</th>
                        <th className="p-3 font-semibold">Role</th>
                        <th className="p-3 font-semibold">Team Tag</th>
                        <th className="p-3 font-semibold">Presence</th>
                        <th className="p-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {users.map(u => (
                        <tr key={u.id} className="transition-colors hover:bg-surface-hover">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar user={u} size="sm" showStatus={false} />
                              <div>
                                <div className="font-semibold flex items-center gap-1.5 text-secondary">
                                  <span>{u.name}</span>
                                  {u.account_status === 'deleted' ? (
                                    <span className="text-xs px-1 rounded bg-surface-hover text-muted font-mono">
                                      DELETED
                                    </span>
                                  ) : !u.isActive ? (
                                    <span className="text-xs px-1 rounded bg-danger/20 text-danger font-mono">
                                      SUSPENDED
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-xs font-mono text-muted">
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
                          <td className="p-3 font-mono text-xs capitalize text-muted">
                            {u.account_status || u.status}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1.5 rounded transition-colors cursor-pointer text-muted hover:text-primary hover:bg-surface-hover"
                                title="Edit User Name, Team & Role"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenResetPassword(u)}
                                className="p-1.5 rounded transition-colors cursor-pointer text-secondary hover:text-primary hover:bg-surface-hover"
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
                                      ? 'bg-surface-hover text-primary'
                                      : 'text-muted hover:text-primary hover:bg-surface-hover'
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
                <div className="p-4 rounded-xl bg-canvas border border-subtle">
                  <h3 className="font-semibold text-sm text-secondary mb-3 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-accent" />
                    Create Custom Channel
                  </h3>

                  {chanCreatedSuccess && (
                    <div className="mb-3 p-2 rounded-lg bg-accent-muted border border-accent/30 text-accent text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Channel created successfully!
                    </div>
                  )}

                  <form onSubmit={handleCreateChannelSubmit} className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-muted mb-1 font-mono text-xs">Channel Name</label>
                        <input
                          type="text"
                          value={newChanName}
                          onChange={e => setNewChanName(e.target.value)}
                          placeholder="e.g. infra-benchmarks"
                          required
                          className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-muted mb-1 font-mono text-xs">Channel Type</label>
                        <select
                          value={newChanType}
                          onChange={e => setNewChanType(e.target.value as ChannelType)}
                          className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent"
                        >
                          <option value="team">Team Channel (Restricted)</option>
                          <option value="public">Public (All Company)</option>
                          <option value="announcement">Announcement (Admin Broadcast Only)</option>
                        </select>
                      </div>
                    </div>

                    {newChanType === 'team' && (
                      <div>
                        <label className="block text-muted mb-1 font-mono text-xs">
                          Target Team (Strict 5 Teams)
                        </label>
                        <select
                          value={newChanTeam}
                          onChange={e => setNewChanTeam(e.target.value as TeamId)}
                          className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent font-mono"
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
                      <label className="block text-muted mb-1 font-mono text-xs">Description & Topic</label>
                      <input
                        type="text"
                        value={newChanDesc}
                        onChange={e => setNewChanDesc(e.target.value)}
                        placeholder="Purpose of this channel..."
                        className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-accent text-white hover:opacity-90 font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Create Channel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="p-5 rounded-xl border bg-canvas border-subtle">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/30 text-accent flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-primary">
                        Fixed Organizational Structure
                      </h4>
                      <p className="text-xs mt-1 leading-relaxed text-muted">
                        Custom channel provisioning is currently disabled by governance policy. The workspace operates under the 5 core organizational departments and corporate broadcast feeds (#announcements, #updates).
                      </p>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setActiveTab('settings')}
                          className="px-3 py-1.5 rounded-lg bg-accent-muted text-accent border border-accent/30 hover:bg-accent/20 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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
                <h4 className="font-semibold text-sm text-secondary">
                  Active Channels ({channels.length})
                </h4>
                <div className="space-y-2">
                  {channels.map(chan => (
                    <div
                      key={chan.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-subtle text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Hash className="w-4 h-4 text-muted" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-secondary">{chan.name}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-surface-hover text-muted font-mono">
                              {chan.type}
                            </span>
                            {chan.team && <TeamBadge team={chan.team} size="sm" />}
                          </div>
                          <p className="text-muted text-xs mt-0.5">{chan.description}</p>
                        </div>
                      </div>

                      {chan.id !== 'c-general' && chan.id !== 'c-announcements' && (
                        <button
                          onClick={() => archiveChannel(chan.id)}
                          className="text-danger hover:underline font-mono text-xs px-2 py-1 rounded hover:bg-danger-muted"
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
                  <h3 className="font-semibold text-sm text-secondary">
                    Security & RBAC Audit Stream
                  </h3>
                  <p className="text-xs text-muted">
                    Immutable administrative ledger tracking RBAC enforcement and provisioning events.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    placeholder="Filter audit logs..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-subtle text-xs text-primary focus:outline-hidden focus:border-accent font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-subtle bg-canvas overflow-hidden font-mono text-xs">
                <div className="divide-y divide-subtle">
                  {auditLogs
                    .filter(
                      log =>
                        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                        log.details.toLowerCase().includes(auditSearch.toLowerCase())
                    )
                    .map(log => (
                      <div key={log.id} className="p-3 hover:bg-canvas/40 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-accent-muted text-accent font-semibold">
                              {log.action}
                            </span>
                            <span className="text-muted">Actor: {log.actorId}</span>
                            <span className="text-muted">•</span>
                            <span className="text-muted">{log.ipAddress}</span>
                          </div>
                          <p className="text-secondary mt-1">{log.details}</p>
                        </div>
                        <span className="text-muted flex-shrink-0">
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
              <div className="p-4 rounded-xl bg-canvas border border-subtle space-y-4">
                <h3 className="font-semibold text-sm text-secondary">
                  Workspace Governance Settings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-muted mb-1 font-mono text-xs">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={e => updateSettings({ name: e.target.value })}
                      className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-muted mb-1 font-mono text-xs">
                      Mesh Domain
                    </label>
                    <input
                      type="text"
                      value={settings.domain}
                      onChange={e => updateSettings({ domain: e.target.value })}
                      className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-muted mb-1 font-mono text-xs">
                      Message Retention Period (Days)
                    </label>
                    <input
                      type="number"
                      value={settings.retentionDays}
                      onChange={e => updateSettings({ retentionDays: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-muted mb-1 font-mono text-xs">
                      Max Attachment Size (MB)
                    </label>
                    <input
                      type="number"
                      value={Math.round(settings.maxUploadSizeBytes / (1024 * 1024))}
                      onChange={e =>
                        updateSettings({ maxUploadSizeBytes: Number(e.target.value) * 1024 * 1024 })
                      }
                      className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-subtle/80">
                    <label className="block text-muted mb-1 font-mono text-xs flex items-center justify-between">
                      <span className="text-secondary font-semibold">Server Link / Remote VPS Address</span>
                      <span className="text-xs text-muted font-sans">Default: Local Server (http://127.0.0.1:8000)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. http://192.168.1.100:8000 or https://chat.company.com"
                      value={settings.serverUrl || ''}
                      onChange={e => updateSettings({ serverUrl: e.target.value })}
                      className="w-full p-2 rounded-lg bg-canvas border border-subtle text-primary focus:outline-hidden focus:border-accent font-mono text-xs"
                    />
                    <p className="text-xs text-muted mt-1">
                      Configure your VPS domain or IP. All web app and PWA clients will route REST API and real-time Socket.IO events to this address.
                    </p>
                  </div>

                  {/* Custom Channel Provisioning Policy Toggle */}
                  <div className="sm:col-span-2 pt-3 border-t border-subtle/80">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <label className="text-secondary font-semibold text-xs flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-accent" />
                          <span>Allow Custom Channel Provisioning</span>
                        </label>
                        <p className="text-xs text-muted mt-0.5">
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
                        <div className="w-11 h-6 bg-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-secondary after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export & Reset Actions */}
              <div className="p-4 rounded-xl bg-canvas border border-subtle flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-sm text-secondary">
                    Data Portability & State Snapshot
                  </h4>
                  <p className="text-xs text-muted">
                    Export full encrypted snapshot or reset local database state.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportBackup}
                    className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface-hover text-secondary flex items-center gap-2 font-mono"
                  >
                    <FileDown className="w-4 h-4" />
                    Export Backup JSON
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetSeedConfirm(true)}
                    className="px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger-muted text-danger border border-danger/30 flex items-center gap-2 font-mono cursor-pointer"
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
            className="w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default bg-surface border-subtle text-primary"
          >
            <div className="flex items-center justify-between pb-3 border-b border-subtle/40 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-muted border border-accent/30 text-accent flex items-center justify-center text-accent">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Edit User Profile</h3>
                  <p className="text-xs text-muted font-mono">@{editingUser.handle} • {editingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={isSavingEdit}
                className="p-1 rounded-md text-muted hover:text-secondary hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-2.5 rounded-lg bg-danger-muted border border-danger/30 text-danger text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-muted mb-1.5 font-medium">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSavingEdit}
                  className="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors bg-surface-hover border-subtle text-primary focus:border-accent"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-muted mb-1.5 font-medium">Assigned Team</label>
                <select
                  value={editTeam}
                  onChange={(e) => setEditTeam(e.target.value as TeamId)}
                  disabled={isSavingEdit}
                  className="w-full px-3 py-2 rounded-lg border text-xs outline-none transition-colors bg-surface-hover border-subtle text-primary focus:border-accent"
                >
                  {Object.entries(TEAMS_META).map(([tId, tMeta]) => (
                    <option key={tId} value={tId}>
                      {tMeta.name} ({tId})
                    </option>
                  ))}
                </select>
                {editingUser.team !== editTeam && (
                  <p className="mt-1 text-xs text-secondary flex items-center gap-1">
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
                      className="rounded border-subtle text-accent focus:ring-accent"
                    />
                    <span className="font-medium text-secondary">Grant Team Leader privileges</span>
                  </label>
                  <p className="text-xs text-muted mt-1 pl-5">
                    Team leaders have moderator authority within their team channels.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-subtle/40">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={isSavingEdit}
                className="px-3.5 py-1.5 rounded-lg text-xs text-muted hover:text-secondary hover:bg-surface-hover cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveUser(false)}
                disabled={isSavingEdit}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
              Are you sure you want to reassign <span className="font-semibold text-secondary">{editingUser?.name}</span> from <span className="font-mono text-secondary">{TEAMS_META[editingUser?.team as TeamId]?.name || editingUser?.team}</span> to <span className="font-mono text-accent">{TEAMS_META[editTeam]?.name || editTeam}</span>?
            </p>
            <p className="mt-2 text-xs text-muted">
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
            className="w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default bg-surface border-subtle text-primary"
          >
            <div className="flex items-center justify-between pb-3 border-b border-subtle/40 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-hover border border-subtle flex items-center justify-center text-secondary">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Reset User Password</h3>
                  <p className="text-xs text-muted font-mono">@{resetTargetUser.handle} • {resetTargetUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                disabled={isResettingPassword}
                className="p-1 rounded-md text-muted hover:text-secondary hover:bg-surface-hover cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted mb-4">
              Resetting password for <span className="font-medium text-secondary">{resetTargetUser.name}</span> will immediately revoke all their active sessions and tokens.
            </p>

            {/* Main-Admin Step-Up Warning Banner & Current Password Field */}
            {Boolean(resetTargetUser.is_main_admin || resetTargetUser.role === 'main_admin') && (
              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-lg border bg-accent/10 border-accent/30 flex items-start gap-2.5 text-xs text-secondary">
                  <Shield className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-primary font-semibold">Main-Admin Protection (Step-Up Auth)</p>
                    <p className="text-xs text-secondary/80 mt-0.5">
                      You are modifying a Main-Admin account. Re-enter your current password to authorize this password change.
                    </p>
                  </div>
                </div>

                {resetPasswordError && (
                  <div className="p-2.5 rounded-lg border bg-danger/10 border-danger/30 flex items-center justify-between text-xs text-danger">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                      <span>{resetPasswordError}</span>
                    </div>
                    <button type="button" onClick={() => setResetPasswordError(null)} className="text-danger hover:underline">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-muted mb-1 font-mono text-xs">
                    Your Current Admin Password <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPasswordForReset ? 'text' : 'password'}
                      value={adminPasswordForReset}
                      onChange={(e) => setAdminPasswordForReset(e.target.value)}
                      disabled={isResettingPassword}
                      placeholder="Enter your current admin password"
                      autoFocus
                      className="w-full px-3 pr-10 py-2 rounded-lg border font-mono text-xs outline-none transition-colors bg-surface-hover border-subtle text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPasswordForReset(!showAdminPasswordForReset)}
                      className="absolute right-3 top-2.5 text-muted hover:text-secondary"
                    >
                      {showAdminPasswordForReset ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-muted mb-1 font-mono text-xs">New Password</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPasswordValue}
                    onChange={(e) => setNewPasswordValue(e.target.value)}
                    disabled={isResettingPassword}
                    className="flex-1 px-3 py-2 rounded-lg border font-mono text-xs outline-none transition-colors bg-surface-hover border-focus text-accent"
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
                    className="px-2.5 py-2 rounded-lg border border-focus hover:bg-surface-hover text-secondary text-xs font-mono cursor-pointer"
                    title="Generate new random password"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-subtle/40">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                disabled={isResettingPassword}
                className="px-3.5 py-1.5 rounded-lg text-xs text-muted hover:text-secondary hover:bg-surface-hover cursor-pointer"
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
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
            className="w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default bg-surface border-subtle text-primary"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center text-accent">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Password Reset Complete</h3>
                <p className="text-xs text-muted">
                  New password for <span className="font-medium text-secondary">{revealedCredentials.user.name}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-canvas border border-emerald-500/30 flex items-center justify-between gap-3 mb-4">
              <span className="font-mono text-base font-semibold text-accent tracking-wider select-all">
                {revealedCredentials.password}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(revealedCredentials.password);
                  setCopiedResetPassword(true);
                  setTimeout(() => setCopiedResetPassword(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-accent-muted hover:bg-accent/20 text-accent border border-accent/30 text-xs font-mono flex items-center gap-1.5 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                {copiedResetPassword ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
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

            <div className="p-3 rounded-lg bg-surface-hover border border-subtle text-secondary text-xs flex items-start gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                Share this password securely with <span className="font-semibold">{revealedCredentials.user.name}</span>. It will not be shown again and is never logged in server or client logs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRevealedCredentials(null)}
              className="w-full py-2 rounded-lg bg-surface-hover hover:bg-surface-hover text-secondary text-xs font-mono font-medium transition-colors cursor-pointer"
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
            className="w-full max-w-md p-6 rounded-2xl shadow-2xl border cursor-default bg-surface border-subtle text-primary"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-surface-hover border border-subtle flex items-center justify-center text-secondary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Authorize Main-Admin Provisioning</h3>
                <p className="text-xs text-muted">Step-Up Authentication Required</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-hover border border-subtle text-xs text-secondary/90 mb-4 space-y-1">
              <p className="font-semibold text-primary font-semibold">You are creating a new Main-Admin account:</p>
              <div className="font-mono text-xs text-primary pl-2">
                <div>• Name: <span className="font-semibold">{newUserName}</span></div>
                <div>• Email: <span className="font-semibold">{newUserEmail}</span></div>
                <div>• Handle: <span className="font-semibold">@{newUserHandle}</span></div>
              </div>
              <p className="text-xs text-secondary/70 pt-1">
                This account will hold full CEO-level administrative privileges over the entire workspace.
              </p>
            </div>

            {adminCreateError && (
              <div className="mb-4 p-2.5 rounded-lg border bg-danger/10 border-danger/30 flex items-center justify-between text-xs text-danger">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                  <span>{adminCreateError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminCreateError(null)}
                  className="text-danger hover:underline"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-muted mb-1 font-mono text-xs">
                  Your Current Admin Password <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminPasswordForCreate ? 'text' : 'password'}
                    value={adminPasswordForCreate}
                    onChange={(e) => setAdminPasswordForCreate(e.target.value)}
                    disabled={isAuthorizingAdminCreate}
                    placeholder="Enter your current password"
                    autoFocus
                    className="w-full px-3 pr-10 py-2 rounded-lg border font-mono text-xs outline-none transition-colors bg-surface-hover border-subtle text-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPasswordForCreate(!showAdminPasswordForCreate)}
                    className="absolute right-3 top-2.5 text-muted hover:text-secondary"
                  >
                    {showAdminPasswordForCreate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-subtle/40">
              <button
                type="button"
                onClick={() => {
                  setShowAdminAuthModal(false);
                  setAdminPasswordForCreate('');
                  setAdminCreateError(null);
                }}
                disabled={isAuthorizingAdminCreate}
                className="px-3.5 py-1.5 rounded-lg text-xs text-muted hover:text-secondary hover:bg-surface-hover cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeProvisionUser(true, adminPasswordForCreate)}
                disabled={isAuthorizingAdminCreate || !adminPasswordForCreate.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                Are you sure you want to delete <strong className="text-primary font-semibold">{deleteTargetUser.name}</strong> (@{deleteTargetUser.handle})? Their account credentials and sessions will be permanently revoked. Historical messages will be preserved as '[Deleted User]'. This action cannot be undone.
              </p>
              {deleteUserError && (
                <div className="p-3 rounded-lg bg-danger-muted border border-danger/30 text-danger text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-danger" />
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
            className="w-48 rounded-xl border shadow-2xl py-1.5 font-sans text-xs animate-in fade-in zoom-in-95 duration-100 bg-surface border-subtle text-primary"
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
                    ? 'text-secondary hover:bg-accent/10'
                    : 'text-accent hover:bg-emerald-500/10'
                  : actionMenu.user.isActive
                  ? 'text-secondary hover:bg-surface-hover'
                  : 'text-secondary hover:bg-surface-hover'
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

            <div className="my-1 border-t border-subtle" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteUserError(null);
                setDeleteTargetUser(actionMenu.user);
                setActionMenu(null);
              }}
              className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-medium text-danger hover:bg-danger-muted hover:text-danger"
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
