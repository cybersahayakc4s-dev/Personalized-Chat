import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import {
  Home,
  MessageSquare,
  Users,
  Bell,
  Bookmark,
  Settings,
  Search,
  Plus,
  ChevronRight,
  ShieldCheck,
  X,
  Sun,
  Moon,
  Megaphone,
  Sparkles,
  Lock,
  SlidersHorizontal,
  ChevronDown,
  Check
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
    openUnauthorizedModal,
    theme,
    setTheme,
    messages = [],
    directMessages = [],
    teamDirectories = [],
    unreadCounts = {},
    pinnedDrawerOpen,
    setPinnedDrawerOpen,
    activityDrawerOpen,
    setActivityDrawerOpen,
    activityNotifications = [],
    setNotificationSettingsModalOpen,
    setProfileModalUser,
    setUserPresenceStatus
  } = useChat() as any;

  const [activeRailTab, setActiveRailTab] = useState<'home' | 'messages' | 'dms'>('home');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [shakingChannelId, setShakingChannelId] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState('');

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
      const text = lastMsg.content?.trim() || (lastMsg.attachments?.length ? 'Attachment' : '');
      return `${firstWord}: ${text}`;
    }
    const teamMeta = (teamDirectories || []).find((t: any) => t.team === teamKey);
    if (teamMeta?.last_message) {
      return teamMeta.last_message;
    }
    return 'No messages yet';
  };

  const colleagues = users.filter((u: any) => {
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

  // Sort with Online colleagues strictly on top
  const sortOnlineFirst = (list: typeof colleagues) => {
    return [...list].sort((a, b) => {
      const aScore = a.status === 'online' ? 2 : a.status === 'busy' ? 1 : 0;
      const bScore = b.status === 'online' ? 2 : b.status === 'busy' ? 1 : 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
  };

  // Only colleagues with whom messages have actually been exchanged
  const contactedColleagues = colleagues.filter((u: any) => {
    const currentNumeric = currentUser.id.replace('usr_', '');
    const otherNumeric = u.id.replace('usr_', '');
    const p1 = Math.min(Number(currentNumeric), Number(otherNumeric));
    const p2 = Math.max(Number(currentNumeric), Number(otherNumeric));
    const dmId = `dm-${p1}-${p2}`;
    const hasHistory = (messages || []).some((m: any) => m.conversationId === dmId);
    return hasHistory || activeConversationId === dmId;
  });

  const filteredColleagues = colleagues.filter((u: any) => {
    if (!dmSearchQuery.trim()) return true;
    const q = dmSearchQuery.toLowerCase().trim();
    return u.name.toLowerCase().includes(q) || u.handle?.toLowerCase().includes(q);
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

  const totalDmUnread = Object.keys(unreadCounts).reduce((acc, key) => {
    if (key.startsWith('dm-')) return acc + (unreadCounts[key] || 0);
    return acc;
  }, 0);

  const renderColleaguesList = (list: typeof colleagues, emptyNotice?: string) => {
    if (list.length === 0) {
      return (
        <div className="px-3 py-2.5 text-center text-xs text-muted bg-surface rounded-md border border-subtle">
          <p className="font-medium text-secondary">
            {emptyNotice || (dmSearchQuery ? 'No matching colleagues' : 'No other members in workspace')}
          </p>
        </div>
      );
    }

    return list.map((user: any) => {
      const currentNumeric = currentUser.id.replace('usr_', '');
      const otherNumeric = user.id.replace('usr_', '');
      const p1 = Math.min(Number(currentNumeric), Number(otherNumeric));
      const p2 = Math.max(Number(currentNumeric), Number(otherNumeric));
      const dmId = `dm-${p1}-${p2}`;
      const isActive = activeConversationId === dmId ||
        activeConversationId.includes(user.id.replace('usr_', '')) ||
        activeConversationId.includes(user.handle);
      const unread = isActive ? 0 : (unreadCounts[dmId] || 0);

      return (
        <button
          key={user.id}
          onClick={() => handleOpenDm(user.id)}
          className={`w-full relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${isActive
              ? 'text-sm font-medium text-primary bg-sidebar-active shadow-2xs'
              : 'text-sm text-secondary hover:bg-sidebar-hover hover:text-primary'
            }`}
        >
          {isActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />
          )}

          <div className="relative shrink-0">
            <Avatar user={user} size="sm" showStatus={true} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-accent rounded-full" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between text-xs">
              <span className={`truncate ${isActive ? 'font-semibold text-primary' : 'font-medium text-primary'}`}>
                {user.name}
              </span>
              {unread > 0 ? (
                <span className="ml-1.5 shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold bg-accent text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : (
                <span className={`text-[11px] font-mono ml-1 shrink-0 capitalize ${
                  user.status === 'online'
                    ? 'text-emerald-500 font-semibold'
                    : user.status === 'busy'
                    ? 'text-rose-500 font-semibold'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}>
                  {user.status || 'offline'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted truncate mt-0.5">
              <span className="truncate">@{user.handle}</span>
              {unread > 0 && (
                <span className="text-xs text-accent font-medium ml-1 shrink-0">
                  New
                </span>
              )}
            </div>
          </div>
        </button>
      );
    });
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

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex h-full transition-transform duration-200 ease-in-out select-none ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        {/* 1. Icon Rail (w-16, bg-rail, neutral) */}
        <nav
          aria-label="Workspace Rail"
          className="w-16 h-full bg-rail border-r border-subtle flex flex-col items-center justify-between py-3 shrink-0 select-none z-10"
        >
          {/* Top: Org / Workspace Avatar (Home Button) */}
          <div className="flex flex-col items-center gap-3 w-full px-3">
            <button
              onClick={() => {
                setActiveRailTab('home');
                setSidebarMobileOpen(false);
              }}
              className="h-10 w-10 rounded-lg overflow-hidden border border-subtle flex items-center justify-center bg-surface shrink-0 hover:opacity-90 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs"
              title="Home — Cyber Sahayak"
              aria-label="Navigate to Home"
            >
              <img
                src="/company-logo.jpeg"
                alt="Cyber Sahayak"
                className="h-full w-full object-cover"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="hidden h-full w-full bg-surface items-center justify-center text-primary font-bold text-xs">
                CS
              </div>
            </button>

            {/* Divider */}
            <div className="w-8 h-px bg-subtle" />

            {/* Icon Navigation Stack */}
            <div className="flex flex-col items-center gap-1.5 w-full">
              {/* 1. Home (Workspace Overview & All Members) */}
              <button
                onClick={() => {
                  setActiveRailTab('home');
                  setChannelsCollapsed(false);
                }}
                className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-all cursor-pointer ${activeRailTab === 'home'
                    ? 'bg-sidebar-active text-primary shadow-xs border border-sidebar-border'
                    : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                  }`}
                title="Home & Directory"
                aria-label="Home"
              >
                {activeRailTab === 'home' && (
                  <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                )}
                <Home className="h-5 w-5" />
              </button>

              {/* 2. Messages (Active Threads & Contacted DMs only) */}
              <button
                onClick={() => {
                  setActiveRailTab('messages');
                  setChannelsCollapsed(false);
                }}
                className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-all cursor-pointer ${activeRailTab === 'messages'
                    ? 'bg-sidebar-active text-primary shadow-xs border border-sidebar-border'
                    : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                  }`}
                title="Messages & Active Conversations"
                aria-label="Messages"
              >
                {activeRailTab === 'messages' && (
                  <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                )}
                <MessageSquare className="h-5 w-5" />
              </button>

              {/* 3. Direct Messages Dedicated Directory */}
              <button
                onClick={() => {
                  setActiveRailTab('dms');
                  setDmsCollapsed(false);
                }}
                className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-all cursor-pointer ${activeRailTab === 'dms'
                    ? 'bg-sidebar-active text-primary shadow-xs border border-sidebar-border'
                    : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                  }`}
                title="Direct Messages"
                aria-label="Direct Messages"
              >
                {activeRailTab === 'dms' && (
                  <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                )}
                <Users className="h-5 w-5" />
                {totalDmUnread > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
                )}
              </button>

              {/* 4. Activity & Mentions (Bell) */}
              <button
                onClick={() => {
                  setActivityDrawerOpen?.((prev: boolean) => !prev);
                }}
                className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-all cursor-pointer ${activityDrawerOpen
                    ? 'bg-sidebar-active text-primary shadow-xs border border-sidebar-border'
                    : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                  }`}
                title="Activity & Mentions"
                aria-label="Activity"
              >
                <Bell className="h-5 w-5" />
                {activityNotifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
                )}
              </button>

              {/* 5. Saved / Pinned Messages */}
              <button
                onClick={() => {
                  setPinnedDrawerOpen?.((prev: boolean) => !prev);
                }}
                className={`relative flex items-center justify-center h-10 w-10 rounded-lg transition-all cursor-pointer ${pinnedDrawerOpen
                    ? 'bg-sidebar-active text-primary shadow-xs border border-sidebar-border'
                    : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                  }`}
                title="Saved & Pinned Messages"
                aria-label="Saved"
              >
                <Bookmark className="h-5 w-5" />
              </button>

              {/* 6. Admin Console (Main Admin only) */}
              {isMainAdmin && (
                <button
                  onClick={() => setAdminModalOpen(true)}
                  className="relative flex items-center justify-center h-10 w-10 rounded-lg text-secondary hover:bg-sidebar-hover hover:text-primary transition-all cursor-pointer"
                  title="Admin Console (Provision Users)"
                  aria-label="Admin Console"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Bottom Rail Actions: Theme Toggle & Settings */}
          <div className="flex flex-col items-center gap-2 w-full px-3">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center h-10 w-10 rounded-lg text-secondary hover:bg-sidebar-hover hover:text-primary transition-colors cursor-pointer"
              title={`Toggle ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Settings button */}
            <button
              onClick={() => setNotificationSettingsModalOpen?.(true)}
              className="flex items-center justify-center h-10 w-10 rounded-lg text-secondary hover:bg-sidebar-hover hover:text-primary transition-colors cursor-pointer"
              title="Preferences & Settings (Appearance, Fonts, Notifications)"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </nav>

        {/* 2. List Panel (w-72 lg:w-80, bg-sidebar, border-r border-subtle) */}
        <div className="w-72 lg:w-80 h-full bg-sidebar border-r border-subtle flex flex-col min-w-0 select-none">
          {/* Workspace Name Header */}
          <div className="h-16 px-4 border-b border-subtle flex items-center justify-between shrink-0 bg-sidebar electron-drag">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-primary tracking-tight truncate">
                  Cyber Sahayak
                </span>
                <ShieldCheck className="h-3.5 w-3.5 text-secondary shrink-0" />
              </div>
              <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                <span>C4S-Connector • v3.1.1</span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setSidebarMobileOpen(false)}
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-sidebar-hover lg:hidden flex items-center justify-center transition-colors cursor-pointer ml-1"
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Bar (Ctrl K) */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-md workspace-search-capsule hover:brightness-95 border text-xs transition-colors group cursor-pointer shadow-2xs"
              title="Global Search & Quick Switcher (Ctrl+K)"
              aria-label="Open global workspace search"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Search className="h-3.5 w-3.5 search-icon transition-colors shrink-0" />
                <span className="search-text text-xs truncate font-medium">Search workspace...</span>
              </span>
              <kbd className="text-xs font-mono px-1.5 py-0.5 rounded search-kbd border">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Scrollable Navigation List */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 custom-sidebar-scroll">
            {activeRailTab === 'dms' ? (
              /* DMs Dedicated View */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-muted">
                    <Users className="h-3.5 w-3.5 text-accent" />
                    <span>Direct Messages</span>
                    <span className="text-xs font-mono text-muted font-normal">({colleagues.length})</span>
                  </div>
                  <button
                    onClick={() => setNewDmModalOpen(true)}
                    className="p-1 rounded text-secondary hover:text-primary hover:bg-sidebar-hover transition-colors cursor-pointer"
                    title="Start new DM"
                    aria-label="Start new direct message"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Colleague filter */}
                <div className="px-0.5">
                  <input
                    type="text"
                    value={dmSearchQuery}
                    onChange={(e) => setDmSearchQuery(e.target.value)}
                    placeholder="Filter colleagues..."
                    className="w-full px-2.5 py-1 text-xs rounded-md bg-surface border border-subtle text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Colleagues list with Online on top */}
                <div className="space-y-0.5">
                  {renderColleaguesList(sortOnlineFirst(filteredColleagues))}
                </div>
              </div>
            ) : (
              /* Home View or Messages View */
              <>
                {/* Section: Channels (Collapsible) */}
                <div>
                  <div
                    onClick={() => setChannelsCollapsed(!channelsCollapsed)}
                    className="px-2 py-1 flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-muted cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${channelsCollapsed ? '-rotate-90' : ''}`}
                      />
                      <span>Channels</span>
                    </div>
                    {currentUser.role === 'main_admin' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewChannelModalOpen(true);
                        }}
                        className="text-secondary hover:text-primary p-0.5 rounded hover:bg-surface-hover transition-colors"
                        title="Create channel"
                        aria-label="Create channel"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {!channelsCollapsed && (
                    <div className="space-y-0.5 mt-1">
                      {/* # announcements */}
                      <button
                        onClick={() => handleSelectConversation('c-announcements')}
                        className={`w-full relative flex items-center justify-between transition-colors cursor-pointer ${activeConversationId === 'c-announcements'
                            ? 'px-2.5 py-1.5 rounded-md text-sm font-semibold text-primary bg-sidebar-active shadow-xs'
                            : 'px-2.5 py-1.5 rounded-md text-sm font-medium text-primary hover:bg-sidebar-hover'
                          }`}
                      >
                        {activeConversationId === 'c-announcements' && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <Megaphone className="h-3.5 w-3.5 shrink-0 text-secondary" />
                          <span className="truncate"># announcements</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(unreadCounts['c-announcements'] || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-accent text-white">
                              {unreadCounts['c-announcements']}
                            </span>
                          )}
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded text-muted bg-sidebar border border-sidebar-border font-medium uppercase select-none">
                            CEO
                          </span>
                        </div>
                      </button>

                      {/* # updates */}
                      <button
                        onClick={() => handleSelectConversation('c-updates')}
                        className={`w-full relative flex items-center justify-between transition-colors cursor-pointer ${activeConversationId === 'c-updates'
                            ? 'px-2.5 py-1.5 rounded-md text-sm font-semibold text-primary bg-sidebar-active shadow-xs'
                            : 'px-2.5 py-1.5 rounded-md text-sm font-medium text-primary hover:bg-sidebar-hover'
                          }`}
                      >
                        {activeConversationId === 'c-updates' && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-secondary" />
                          <span className="truncate"># updates</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(unreadCounts['c-updates'] || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-accent text-white">
                              {unreadCounts['c-updates']}
                            </span>
                          )}
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded text-muted bg-surface border border-subtle font-medium uppercase select-none">
                            Leads
                          </span>
                        </div>
                      </button>

                      {/* Department Channels */}
                      {departmentChannels.map((teamChan: any) => {
                        const isExpanded = Boolean(expandedTeams[teamChan.id]);
                        const teamKey = teamChan.team;
                        const isAuthorized = isMainAdmin || currentUser.team === teamKey;
                        const isCurrentActive = activeConversationId === teamChan.id;
                        const snippet = getDepartmentSnippet(teamChan.id, teamKey);
                        const isShaking = shakingChannelId === teamChan.id;

                        const teamMembers = users.filter((u: any) => {
                          if (u.id === currentUser.id) return false;
                          if (u.team !== teamKey) return false;
                          const isDel = u.account_status === 'deleted' || u.status === 'deleted' || u.name === '[Deleted User]';
                          return !isDel;
                        });

                        return (
                          <div key={teamChan.id} className="space-y-0.5">
                            <div className="relative group/chan flex items-center">
                              <button
                                onClick={() => {
                                  if (!isAuthorized) {
                                    setShakingChannelId(teamChan.id);
                                    setTimeout(() => setShakingChannelId(null), 500);
                                    openUnauthorizedModal(teamChan.name, teamChan.team, 'You are not assigned to this department.');
                                    return;
                                  }
                                  handleSelectConversation(teamChan.id);
                                }}
                                className={`w-full flex items-center justify-between text-left transition-colors cursor-pointer py-1.5 pl-2.5 pr-2 rounded-md ${isShaking ? 'animate-shake' : ''
                                  } ${isCurrentActive
                                    ? 'font-medium text-primary bg-sidebar-active shadow-2xs'
                                    : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                                  }`}
                              >
                                {isCurrentActive && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-accent" />
                                )}

                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-muted font-mono text-xs shrink-0">#</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-xs truncate ${isCurrentActive ? 'font-semibold text-primary' : 'font-medium text-primary'}`}>
                                        {teamChan.name}
                                      </span>
                                      {!isAuthorized && (
                                        <Lock className="h-3 w-3 text-muted shrink-0" />
                                      )}
                                    </div>
                                    <div className="text-xs text-muted truncate mt-0.5">
                                      {snippet}
                                    </div>
                                  </div>
                                </div>
                              </button>

                              {/* Toggle Accordion */}
                              {isAuthorized && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTeams(prev => ({
                                      ...prev,
                                      [teamChan.id]: !prev[teamChan.id]
                                    }));
                                  }}
                                  className="p-1 rounded text-muted hover:text-primary hover:bg-sidebar-hover transition-colors shrink-0 ml-0.5"
                                  title={isExpanded ? 'Collapse members' : 'Expand members'}
                                >
                                  <ChevronRight
                                    className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  />
                                </button>
                              )}
                            </div>

                            {/* Accordion Member Sub-list */}
                            {isExpanded && isAuthorized && (
                              <div className="pl-5 pr-1 py-1 space-y-0.5 border-l border-sidebar-border ml-3 mt-0.5">
                                {teamMembers.length === 0 ? (
                                  <div className="text-xs text-muted px-2 py-1 italic">
                                    No other members in this team
                                  </div>
                                ) : (
                                  teamMembers.map((member: any) => {
                                    const cNum = currentUser.id.replace('usr_', '');
                                    const oNum = member.id.replace('usr_', '');
                                    const p1 = Math.min(Number(cNum), Number(oNum));
                                    const p2 = Math.max(Number(cNum), Number(oNum));
                                    const dmId = `dm-${p1}-${p2}`;
                                    const isSubActive = activeConversationId === dmId;

                                    return (
                                      <button
                                        key={member.id}
                                        onClick={() => handleOpenDm(member.id)}
                                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors text-left cursor-pointer ${isSubActive
                                            ? 'text-primary font-medium bg-sidebar-active shadow-2xs'
                                            : 'text-secondary hover:bg-sidebar-hover hover:text-primary'
                                          }`}
                                      >
                                        <Avatar user={member} size="xs" showStatus={true} />
                                        <span className="truncate flex-1 text-primary font-medium">{member.name}</span>
                                        {member.role === 'main_admin' && (
                                          <span className="text-xs px-1 py-0.5 rounded font-mono bg-sidebar text-primary border border-sidebar-border shrink-0">
                                            CEO
                                          </span>
                                        )}
                                        {member.title === 'Team Lead' && (
                                          <span className="text-xs px-1 py-0.5 rounded font-mono bg-sidebar text-secondary border border-sidebar-border shrink-0">
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
                  )}
                </div>

                {/* Main-Admin Daily Team Updates Carousel */}
                {isMainAdmin && (
                  <TeamUpdatesCarousel onOpenScheduler={() => setScheduleUpdateModalOpen(true)} />
                )}

                {/* Direct Messages Section */}
                <div>
                  <div
                    onClick={() => setDmsCollapsed(!dmsCollapsed)}
                    className="px-2 py-1 flex items-center justify-between text-xs font-semibold tracking-wider uppercase text-muted cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${dmsCollapsed ? '-rotate-90' : ''}`}
                      />
                      <span>
                        {activeRailTab === 'messages' ? 'Active Direct Messages' : 'Direct Messages'}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewDmModalOpen(true);
                      }}
                      className="text-secondary hover:text-primary p-0.5 rounded hover:bg-sidebar-hover transition-colors"
                      title="Start 1:1 message"
                      aria-label="Start 1:1 message"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {!dmsCollapsed && (
                    <div className="space-y-0.5 mt-1">
                      {activeRailTab === 'messages'
                        ? renderColleaguesList(
                          sortOnlineFirst(contactedColleagues),
                          'No active direct message threads yet.'
                        )
                        : renderColleaguesList(
                          sortOnlineFirst(colleagues)
                        )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom User Profile Bar (Single Account, Clean, No Switch Account) */}
          <div className="p-2 border-t border-sidebar-border bg-sidebar shrink-0">
            <div
              onClick={() => setProfileModalUser(currentUser)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-sidebar-hover text-left transition-colors cursor-pointer"
              title="View your profile"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Avatar user={currentUser} size="sm" showStatus={true} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-primary truncate">
                      {currentUser.name}
                    </span>
                    {currentUser.role === 'main_admin' && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-surface text-primary border border-subtle">
                        CEO
                      </span>
                    )}
                    {currentUser.is_team_leader && currentUser.role !== 'main_admin' && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-surface text-secondary border border-subtle">
                        Lead
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {currentUser.title || `@${currentUser.handle}`}
                  </div>
                </div>
              </div>
              <div className="relative shrink-0 ml-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusMenuOpen(!statusMenuOpen);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-surface border border-subtle focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary transition-all cursor-pointer select-none"
                  title="Change presence status (Online, Busy, Offline)"
                  aria-label="Change status"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${currentUser.status === 'busy'
                        ? 'bg-rose-500 ring-2 ring-rose-500/20'
                        : currentUser.status === 'offline'
                          ? 'bg-slate-400 dark:bg-zinc-500 ring-1 ring-slate-400/20'
                          : 'bg-emerald-500 ring-2 ring-emerald-500/20'
                      }`}
                  />
                  <span className="text-xs font-mono capitalize text-primary font-medium">
                    {currentUser.status || 'online'}
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 text-secondary" />
                </button>

                {statusMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusMenuOpen(false);
                      }}
                    />
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2 w-48 rounded-xl bg-surface border border-subtle shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted font-mono">
                        Set Presence Status
                      </div>
                      {[
                        { id: 'online', label: 'Online', desc: 'Active and available', dot: 'bg-emerald-500 ring-1 ring-emerald-500/30' },
                        { id: 'busy', label: 'Busy', desc: 'Do not disturb', dot: 'bg-rose-500 ring-1 ring-rose-500/30' },
                        { id: 'offline', label: 'Appear Offline', desc: 'Invisible to others', dot: 'bg-slate-400 dark:bg-zinc-500 ring-1 ring-slate-400/30' }
                      ].map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setUserPresenceStatus?.(st.id as any);
                            setStatusMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${currentUser.status === st.id
                              ? 'bg-surface-hover text-primary font-semibold'
                              : 'text-secondary hover:bg-surface-hover hover:text-primary'
                            }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${st.dot} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium leading-tight">{st.label}</div>
                            <div className="text-xs text-muted leading-tight mt-0.5">{st.desc}</div>
                          </div>
                          {currentUser.status === st.id && (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
