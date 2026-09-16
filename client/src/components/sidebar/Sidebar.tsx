import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { MeshNodeInfoModal } from '../modals/MeshNodeInfoModal';
import { UserSwitcher } from './UserSwitcher';
import {
  Search,
  Plus,
  ChevronRight,
  ShieldCheck,
  ChevronsUpDown,
  Settings,
  FolderClosed,
  X,
  Sun,
  Moon,
  Megaphone,
  Sparkles,
  Hash,
  LogIn,
  Lock,
  SlidersHorizontal
} from 'lucide-react';
import { isChannelAuthorized } from '../../utils/rbac';
import { TeamUpdatesCarousel } from './TeamUpdatesCarousel';

export const Sidebar: React.FC = () => {
  const {
    currentUser,
    users,
    channels,
    activeConversationId,
    setActiveConversationId,
    createOrOpenDm,
    setAdminModalOpen,
    setNewChannelModalOpen,
    setNewDmModalOpen,
    setCommandPaletteOpen,
    setLoginModalOpen,
    setScheduleUpdateModalOpen,
    sidebarMobileOpen,
    setSidebarMobileOpen,
    setProfileModalUser,
    openUnauthorizedModal,
    theme,
    setTheme,
    messages = [],
    directMessages = [],
    teamDirectories = [],
    unreadCounts = {}
  } = useChat() as any;

  const [meshNodeModalOpen, setMeshNodeModalOpen] = useState(false);
  const [shakingChannelId, setShakingChannelId] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  // Strict Department RBAC: Main-Admin sees all 5 departments; regular employees see ONLY their assigned department
  const isMainAdmin = currentUser.role === 'main_admin';
  const departmentChannels = (channels || []).filter((c: any) => {
    if (c.type !== 'team' && !c.team) return false;
    if (c.isArchived) return false;
    if (isMainAdmin) return true;
    return c.team === currentUser.team;
  });

  const getDepartmentSnippet = (chanId: string, teamKey?: string) => {
    const chanMsgs = (messages || []).filter((m: any) => m.conversationId === chanId);
    if (chanMsgs.length > 0) {
      const lastMsg = chanMsgs[chanMsgs.length - 1];
      if (lastMsg.isDeleted) return 'Message deleted';
      const senderObj = users.find((u: any) => u.id === lastMsg.senderId);
      const sName = lastMsg.senderId === currentUser.id ? 'You' : (senderObj?.name || 'Colleague');
      const firstWord = sName.split(' ')[0];
      const text = lastMsg.content?.trim() || (lastMsg.attachments?.length ? '📎 Attachment' : '');
      return `${firstWord}: ${text}`;
    }
    const teamMeta = (teamDirectories || []).find((t: any) => t.team === teamKey);
    if (teamMeta?.last_message) {
      return teamMeta.last_message;
    }
    return 'No messages yet';
  };

  const colleagues = users.filter(u => {
    if (u.id === currentUser.id) return false;
    const isDeleted = u.account_status === 'deleted' ||
      u.status === 'deleted' ||
      u.name === '[Deleted User]' ||
      u.handle?.startsWith('deleted_') ||
      (u.email && u.email.includes('@archived.internal'));
    if (isDeleted) {
      const currentNumeric = currentUser.id.replace('usr_', '');
      const otherNumeric = u.id.replace('usr_', '');
      const p1 = Math.min(Number(currentNumeric), Number(otherNumeric));
      const p2 = Math.max(Number(currentNumeric), Number(otherNumeric));
      const dmId = `dm-${p1}-${p2}`;
      const hasMessages = (messages || []).some((m: any) => m.conversationId === dmId);
      const hasDmSession = (directMessages || []).some((dm: any) =>
        dm.participants?.includes(currentUser.id) && dm.participants?.includes(u.id)
      );
      return hasMessages || hasDmSession || activeConversationId === dmId;
    }
    return true;
  });

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    if (setSidebarMobileOpen) {
      setSidebarMobileOpen(false);
    }
  };

  const handleOpenDm = (userId: string) => {
    createOrOpenDm(userId);
    if (setSidebarMobileOpen) {
      setSidebarMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarMobileOpen(false)}
        />
      )}

      {/* Mesh Node Telemetry Modal */}
      <MeshNodeInfoModal
        isOpen={meshNodeModalOpen}
        onClose={() => setMeshNodeModalOpen(false)}
      />

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[clamp(240px,85vw,270px)] max-w-[270px] bg-[#0c121e] text-slate-300 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out select-none ${
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header: Cyber Sahayak Logo + C4S-Connector & Theme Toggle */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0 bg-[#0c121e] electron-drag">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700/60 flex items-center justify-center bg-slate-900 shadow-sm flex-shrink-0">
              <img
                src="/company-logo.jpeg"
                alt="Cyber Sahayak Logo"
                className="w-full h-full object-cover"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 items-center justify-center text-white font-bold text-xs">
                CS
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white tracking-tight truncate">
                  Cyber Sahayak
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>C4S-Connector • v2.2.0</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {currentUser?.role === 'main_admin' && (
              <button
                onClick={() => setAdminModalOpen(true)}
                className="p-1.5 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600/20 transition-colors"
                title="Admin Console (Provision Users)"
                aria-label="Admin Console"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setTheme(theme === 'slate' ? 'nordic' : 'slate')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={`Switch to ${theme === 'slate' ? 'Light' : 'Dark'} Theme`}
            >
              {theme === 'slate' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-300" />
              )}
            </button>

            <button
              onClick={() => setSidebarMobileOpen(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700 lg:hidden flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Global Search Bar */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#141c2e] hover:bg-[#1a253c] border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-all shadow-xs group cursor-pointer"
            title="Global Search & Quick Switcher (Ctrl+K)"
            aria-label="Open global workspace search"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
              <span className="text-slate-400 group-hover:text-slate-200 text-xs truncate">Search workspace...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 group-hover:border-slate-600 group-hover:text-slate-300 transition-colors shrink-0">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Main Nav Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 custom-sidebar-scroll">
          {/* Section: Channels (Announcements & Updates) */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              <span>Channels</span>
            </div>

            <div className="space-y-0.5 mt-1">
              {/* # announcements */}
              <button
                onClick={() => handleSelectConversation('c-announcements')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  activeConversationId === 'c-announcements'
                    ? 'bg-[#1C2638] text-white font-medium border border-[#2D3C54] shadow-xs'
                    : (unreadCounts['c-announcements'] || 0) > 0
                    ? 'bg-[#131f37] text-white hover:bg-[#1a2947]'
                    : 'text-slate-300 hover:bg-[#131b2b] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Megaphone className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                  <span className={`truncate ${(unreadCounts['c-announcements'] || 0) > 0 ? 'font-bold text-white' : ''}`}># announcements</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(unreadCounts['c-announcements'] || 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white shadow-sm animate-pulse">
                      {unreadCounts['c-announcements']}
                    </span>
                  )}
                  <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded text-slate-400 bg-slate-800/80 border border-slate-700/60 font-medium uppercase select-none">
                    CEO
                  </span>
                </div>
              </button>

              {/* # updates */}
              <button
                onClick={() => handleSelectConversation('c-updates')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  activeConversationId === 'c-updates'
                    ? 'bg-[#1C2638] text-white font-medium border border-[#2D3C54] shadow-xs'
                    : (unreadCounts['c-updates'] || 0) > 0
                    ? 'bg-[#131f37] text-white hover:bg-[#1a2947]'
                    : 'text-slate-300 hover:bg-[#131b2b] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                  <span className={`truncate ${(unreadCounts['c-updates'] || 0) > 0 ? 'font-bold text-white' : ''}`}># updates</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(unreadCounts['c-updates'] || 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white shadow-sm animate-pulse">
                      {unreadCounts['c-updates']}
                    </span>
                  )}
                  <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded text-slate-400 bg-slate-800/80 border border-slate-700/60 font-medium uppercase select-none">
                    Leads
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Departments (5 Fixed Teams) */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              <span>Departments</span>
              {currentUser.role === 'main_admin' && (
                <button
                  onClick={() => setNewChannelModalOpen(true)}
                  className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
                  title="Create channel"
                >
                  <FolderClosed className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="space-y-0.5 mt-1">
              {departmentChannels.map((teamChan: any) => {
                const isActive = activeConversationId === teamChan.id;
                const teamUnread = unreadCounts[teamChan.id] || 0;
                const accessCheck = isChannelAuthorized(teamChan, currentUser);
                const isAuthorized = accessCheck.authorized;
                const teamMembers = users.filter((u: any) => u.team === teamChan.team && u.account_status !== 'deleted' && u.status !== 'deleted' && u.name !== '[Deleted User]');
                const memberCount = teamMembers.length;
                const isExpanded = Boolean(expandedTeams[teamChan.id]);
                const isShaking = shakingChannelId === teamChan.id;

                return (
                  <div key={teamChan.id} className="space-y-0.5">
                    <div
                      className={`w-full flex items-start justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#1C2638] text-white font-medium border border-[#2D3C54] shadow-xs'
                          : isShaking
                          ? 'bg-rose-500/15 text-rose-200'
                          : !isAuthorized
                          ? 'text-slate-400/80 hover:bg-slate-800/40 hover:text-slate-300'
                          : teamUnread > 0
                          ? 'bg-[#131f37] text-white hover:bg-[#1a2947]'
                          : 'text-slate-300 hover:bg-[#131b2b] hover:text-white'
                      }`}
                      onClick={() => {
                        if (!isAuthorized) {
                          setShakingChannelId(teamChan.id);
                          setTimeout(() => {
                            setShakingChannelId(curr => (curr === teamChan.id ? null : curr));
                          }, 450);
                          openUnauthorizedModal?.(teamChan.name, teamChan.team, accessCheck.reason);
                          return;
                        }
                        handleSelectConversation(teamChan.id);
                      }}
                    >
                      {/* Left: Expand Chevron + Clickable Team Name & Last Message Preview */}
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTeams(prev => ({
                              ...prev,
                              [teamChan.id]: !prev[teamChan.id]
                            }));
                          }}
                          className="p-1 -ml-1 mt-0.5 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                          title={isExpanded ? "Collapse member directory" : "Expand member directory"}
                        >
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90 text-white' : 'text-slate-500'
                            }`}
                          />
                        </button>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!isAuthorized && (
                              <Lock
                                className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                                  isShaking ? 'animate-lock-shake text-rose-400' : 'text-slate-400'
                                }`}
                              />
                            )}
                            <span className={`truncate ${teamUnread > 0 ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                              {teamChan.name}
                            </span>
                          </div>

                          {/* h5 preview line: who sent the last message and what was it */}
                          <h5 className="text-[11px] text-slate-400 truncate font-normal tracking-tight mt-0.5">
                            {getDepartmentSnippet(teamChan.id, teamChan.team)}
                          </h5>
                        </div>
                      </div>

                      {/* Right: Unread / Member Count */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {teamUnread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40 animate-pulse">
                            {teamUnread}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTeams(prev => ({
                              ...prev,
                              [teamChan.id]: !prev[teamChan.id]
                            }));
                          }}
                          className="text-[11px] font-mono text-slate-400 hover:text-white font-medium px-1 cursor-pointer"
                          title="Toggle member directory"
                        >
                          {memberCount > 0 ? `${memberCount}` : '0'}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Member Directory (Accordion Dropdown) */}
                    {isExpanded && (
                      <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-slate-800/80 ml-3 animate-in fade-in slide-in-from-top-1 duration-150">
                        {teamMembers.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-1 px-2">
                            No members assigned
                          </div>
                        ) : (
                          teamMembers.map((member: any) => {
                            const isSelf = member.id === currentUser.id;
                            return (
                              <button
                                key={member.id}
                                onClick={() => {
                                  if (!isSelf) {
                                    handleOpenDm(member.id);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition-colors ${
                                  isSelf
                                    ? 'opacity-60 cursor-default'
                                    : 'hover:bg-[#131b2b] text-slate-300 hover:text-white cursor-pointer'
                                }`}
                                title={isSelf ? 'You' : `Send message to ${member.name}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar user={member} size="xs" showStatus={true} />
                                  <span className="text-xs truncate">
                                    {member.name} {isSelf && '(You)'}
                                  </span>
                                </div>
                                {member.role === 'main_admin' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30 flex-shrink-0">
                                    CEO
                                  </span>
                                )}
                                {member.title === 'Team Lead' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 flex-shrink-0">
                                    Lead
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main-Admin Daily Team Updates Carousel */}
          {isMainAdmin && (
            <TeamUpdatesCarousel onOpenScheduler={() => setScheduleUpdateModalOpen(true)} />
          )}

          {/* Section: Direct Messages */}
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              <span>Direct Messages</span>
              <button
                onClick={() => setNewDmModalOpen(true)}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
                title="Start 1:1 message"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5 mt-1">
              {colleagues.length === 0 ? (
                <div className="px-3 py-2.5 text-center text-xs text-slate-400 bg-[#141c2e]/60 rounded-lg border border-slate-800/80">
                  <p className="font-medium text-slate-300">No other members</p>
                  <button
                    onClick={() => setLoginModalOpen(true)}
                    className="mt-1 text-[11px] text-blue-400 hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <span>Switch Account</span>
                  </button>
                </div>
              ) : (
                colleagues.map(user => {
                  const currentNumeric = currentUser.id.replace('usr_', '');
                  const otherNumeric = user.id.replace('usr_', '');
                  const p1 = Math.min(Number(currentNumeric), Number(otherNumeric));
                  const p2 = Math.max(Number(currentNumeric), Number(otherNumeric));
                  const dmId = `dm-${p1}-${p2}`;
                  const isActive = activeConversationId === dmId || activeConversationId.includes(user.id.replace('usr_', '')) || activeConversationId.includes(user.handle);
                  const unread = isActive ? 0 : (unreadCounts[dmId] || 0);

                  return (
                    <button
                      key={user.id}
                      onClick={() => handleOpenDm(user.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors relative cursor-pointer ${
                        isActive
                          ? 'bg-[#182338] text-white font-medium shadow-xs'
                          : unread > 0
                          ? 'bg-[#131f37] text-white hover:bg-[#1a2947]'
                          : 'text-slate-300 hover:bg-[#131b2b] hover:text-white'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar user={user} size="sm" showStatus={true} />
                        {unread > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-[#0c121e] animate-ping" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`truncate ${unread > 0 ? 'font-bold text-white' : 'font-medium text-slate-200'}`}>
                            {user.name}
                          </span>
                          {unread > 0 ? (
                            <span className="ml-1.5 flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50 animate-pulse">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          ) : (
                            <span className={`text-[10px] font-mono ml-1 flex-shrink-0 ${
                              user.status === 'online'
                                ? 'text-emerald-400 font-medium'
                                : user.status === 'busy'
                                ? 'text-amber-400 font-medium'
                                : 'text-slate-500'
                            }`}>
                              {user.status || 'offline'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 truncate mt-0.5">
                          <span className="truncate">@{user.handle}</span>
                          {unread > 0 && (
                            <span className="text-[10px] text-blue-400 font-semibold ml-1 flex-shrink-0">
                              New message
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom User Profile & Account Switcher Bar */}
        <div className="p-2 border-t border-slate-800/80 bg-[#0c121e] flex items-center justify-between flex-shrink-0">
          <UserSwitcher />
        </div>
      </aside>
    </>
  );
};
