import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

import { useChat } from '../../context/ChatContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { InChatSearchBar } from './InChatSearchBar';
import { Avatar } from '../common/Avatar';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Search,
  Pin,
  Users,
  Sparkles,
  Megaphone,
  Hash,
  Sun,
  Moon,
  Lock,
  ArrowRight,
  ArrowDown,
  PanelRight,
  Bell,
  BellOff,
  Sliders,
  Clock,
  X
} from 'lucide-react';
import { getUserDepartmentChannel } from '../../utils/rbac';
import { formatDateDivider, getDayKey } from '../../utils/date';
import { QuickReplyPopup } from './QuickReplyPopup';
import { getUserNameColor } from '../../utils/userColors';
import { NotificationSettingsModal } from './NotificationSettingsModal';

export const ChatArea: React.FC = () => {
  const {
    activeConversationId,
    activeConversation,
    isDm,
    messages,
    users,
    currentUser,
    channels,
    setActiveConversationId,
    isCurrentConversationAccessible,
    inaccessibilityReason,
    pinnedDrawerOpen,
    setPinnedDrawerOpen,
    membersDrawerOpen,
    setMembersDrawerOpen,
    setSidebarMobileOpen,
    theme,
    setTheme,
    highlightedMessageId,
    setHighlightedMessageId,
    desktopNotificationPermission,
    requestDesktopNotificationPermission,
    sendTestDesktopNotification,
    setNotificationSettingsModalOpen,
    setScheduleUpdateModalOpen,
    setProfileModalUser,
    addToast,
    chatGradient
  } = useChat() as any;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesContentRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef<boolean>(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Sync with global search message highlight & scroll
  useEffect(() => {
    if (!highlightedMessageId) return;
    setSelectedMessageId(highlightedMessageId);

    const scrollTimer = setTimeout(() => {
      const cleanId = highlightedMessageId.startsWith('msg-') ? highlightedMessageId : `msg-${highlightedMessageId}`;
      const el = document.getElementById(cleanId) || document.getElementById(`msg-${cleanId}`) || document.getElementById(highlightedMessageId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    const clearTimer = setTimeout(() => {
      setSelectedMessageId(null);
      if (setHighlightedMessageId) {
        setHighlightedMessageId(null);
      }
    }, 3500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedMessageId, setHighlightedMessageId]);

  // Filter messages for current conversation with strict deduplication
  const currentMessages = useMemo(() => {
    const raw = messages.filter(
      (m: any) => m.conversationId === activeConversationId
    );

    // Identify confirmed messages by signature (senderId + content)
    const confirmedSignatures = new Set<string>();
    for (const msg of raw) {
      if (!msg.id.startsWith('msg-temp-')) {
        confirmedSignatures.add(`${msg.senderId}::${msg.content.trim()}`);
      }
    }

    const seenIds = new Set<string>();
    const deduped: any[] = [];
    for (const msg of raw) {
      if (seenIds.has(msg.id)) continue;

      // If this is an optimistic temp message, but a confirmed message with same sender & content exists, suppress it
      if (msg.id.startsWith('msg-temp-')) {
        const sig = `${msg.senderId}::${msg.content.trim()}`;
        if (confirmedSignatures.has(sig)) continue;
      }

      seenIds.add(msg.id);
      deduped.push(msg);
    }
    return deduped;
  }, [messages, activeConversationId]);

  const pinnedCount = currentMessages.filter((m: any) => m.isPinned).length;


  // Deterministic scroll to absolute bottom of the chat container
  const scrollToBottom = useCallback((instant = true) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      if (instant) {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }

    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({
          behavior: instant ? 'auto' : 'smooth',
          block: 'end'
        });
      } catch (e) {
        // Fallback ignore
      }
    }
  }, []);

  // Multi-pass execution to ensure scroll reaches true bottom as async history loads,
  // images finish rendering, and DOM layout calculates final heights.
  const executeScrollToBottom = useCallback((instant = true) => {
    scrollToBottom(instant);
    requestAnimationFrame(() => {
      scrollToBottom(instant);
      requestAnimationFrame(() => {
        scrollToBottom(instant);
      });
    });
    setTimeout(() => scrollToBottom(instant), 40);
    setTimeout(() => scrollToBottom(instant), 120);
    setTimeout(() => scrollToBottom(instant), 260);
  }, [scrollToBottom]);

  // When active conversation changes, unconditionally reset scroll state and snap to bottom
  useEffect(() => {
    isUserScrolledUpRef.current = false;
    setShowScrollToBottomButton(false);
    executeScrollToBottom(true);
  }, [activeConversationId, executeScrollToBottom]);

  // Scroll to bottom when new messages arrive or history finishes loading
  useEffect(() => {
    if (selectedMessageId) return;

    const lastMsg = currentMessages[currentMessages.length - 1];
    const isOwnLastMessage = lastMsg && (lastMsg.senderId === currentUser.id || lastMsg.id?.startsWith('msg-temp-'));

    // Always scroll for own messages or if the user hasn't scrolled up to read older history
    if (isOwnLastMessage || !isUserScrolledUpRef.current) {
      executeScrollToBottom(true);
    }
  }, [currentMessages, currentUser.id, selectedMessageId, executeScrollToBottom]);

  // ResizeObserver to catch async height changes (image attachments loaded, backend history resolved, font loading)
  useEffect(() => {
    if (!messagesContentRef.current || !scrollContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!isUserScrolledUpRef.current && !selectedMessageId) {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      }
    });

    resizeObserver.observe(messagesContentRef.current);
    return () => resizeObserver.disconnect();
  }, [selectedMessageId]);

  // Track scroll position to know when user has intentionally scrolled up to read history
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    // User is considered scrolled up if more than 120px from bottom
    const isScrolledUp = distanceFromBottom > 120;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollToBottomButton(isScrolledUp);
  }, []);

  // Keyboard shortcut: Cmd+F / Ctrl+F for in-chat search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setInChatSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Recipient or channel metadata
  const otherUser = isDm ? (activeConversation as any)?.otherUser : null;
  const channelData = !isDm ? (activeConversation as any) : null;

  const isAnnouncement = activeConversationId === 'c-announcements';
  const isUpdates = activeConversationId === 'c-updates';
  const isChannel = !isDm && (isAnnouncement || isUpdates || channelData?.type === 'announcement' || channelData?.type === 'public' || !channelData?.team);

  let headerTitle = 'Team';
  let headerSubtitle = '';

  if (isDm) {
    headerTitle = otherUser?.name || 'Team Member';
    const otherStatus = otherUser?.status || 'offline';
    headerSubtitle = `@${otherUser?.handle || 'user'} • ${otherStatus === 'online' ? 'Active' : otherStatus === 'busy' ? 'Busy' : 'Offline'}`;
  } else if (isAnnouncement) {
    headerTitle = '# announcements';
    headerSubtitle = 'Official company bulletins • CEO / Main-Admin only';
  } else if (isUpdates) {
    headerTitle = '# updates';
    headerSubtitle = 'Weekly progress reports & milestones • Team Leads & CEO';
  } else if (channelData) {
    const isTeam = channelData.type === 'team' || Boolean(channelData.team);
    headerTitle = isTeam ? channelData.name : `# ${channelData.name}`;
    const activeWorkspaceUsers = (users || []).filter((u: any) =>
      u.account_status !== 'deleted' &&
      u.status !== 'deleted' &&
      !u.is_deleted &&
      !u.name?.includes('[Deleted User]') &&
      !(u.email && u.email?.includes('@archived.internal'))
    );
    const memberCount = channelData.team
      ? activeWorkspaceUsers.filter((u: any) => u.team === channelData.team || u.role === 'main_admin').length
      : activeWorkspaceUsers.length;
    headerSubtitle = isTeam ? `Department • ${memberCount} member${memberCount === 1 ? '' : 's'}` : `Channel • ${memberCount} member${memberCount === 1 ? '' : 's'}`;
  }

  const isDark = theme !== 'light';

  return (
    <TooltipProvider>
      <div
        className="flex-1 flex flex-col h-full text-primary overflow-hidden min-w-0 transition-colors"
        style={{ background: `var(--chat-gradient-${chatGradient || 'cobalt'})` }}
      >
        {/* 1. Application Header (Channel / DM Title & Quick Actions) */}
        <header className="h-16 border-b border-subtle bg-canvas/70 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0 select-none transition-colors electron-drag z-10">
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
            <button
              onClick={() => setSidebarMobileOpen(true)}
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover lg:hidden cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {isDm ? (
              <button
                type="button"
                onClick={() => otherUser && setProfileModalUser?.(otherUser)}
                className="flex items-center gap-2 sm:gap-3.5 min-w-0 cursor-pointer group text-left focus:outline-none"
                title={`View ${otherUser?.name || 'User'}'s profile`}
                aria-label={`View ${otherUser?.name || 'User'}'s profile`}
              >
                <Avatar
                  user={otherUser || ({ name: headerTitle, status: 'online', team: 'team_ai' } as any)}
                  size="md"
                  showStatus={true}
                  className="group-hover:ring-2 group-hover:ring-accent/40 rounded-full transition-all"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1
                      className="font-semibold text-base tracking-tight truncate text-primary group-hover:underline"
                      style={isDm && otherUser ? { color: getUserNameColor(otherUser.id, otherUser.name) } : undefined}
                    >
                      {headerTitle}
                    </h1>
                  </div>
                  <div className="text-xs text-muted flex items-center gap-2 mt-0.5 truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>@{otherUser?.handle || 'user'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${
                          otherUser?.status === 'online'
                            ? 'bg-emerald-500 ring-1 ring-emerald-500/20'
                            : otherUser?.status === 'busy'
                            ? 'bg-rose-500 ring-1 ring-rose-500/20'
                            : 'bg-slate-400 dark:bg-zinc-500'
                        }`} />
                        <span className={`font-normal ${
                          otherUser?.status === 'online'
                            ? 'text-emerald-500 font-medium'
                            : otherUser?.status === 'busy'
                            ? 'text-rose-500 font-medium'
                            : 'text-slate-400 dark:text-zinc-500'
                        }`}>
                          {otherUser?.status === 'online' ? 'Online' : otherUser?.status === 'busy' ? 'Busy' : 'Offline'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm bg-surface border border-subtle text-secondary">
                  {isAnnouncement ? <Megaphone className="h-4 w-4" /> : isUpdates ? <Sparkles className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-semibold text-base tracking-tight truncate text-primary">
                      {headerTitle}
                    </h1>
                  </div>
                  <div className="text-xs text-muted flex items-center gap-2 mt-0.5 truncate">
                    <span className="truncate">{headerSubtitle}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Windows Desktop Notifications Quick Toggle */}
            <button
              onClick={async () => {
                if (desktopNotificationPermission === 'granted') {
                  sendTestDesktopNotification?.();
                  addToast?.({
                    type: 'info',
                    title: 'Windows Notification Sent',
                    description: 'Look at the bottom-right of your Windows desktop for the popup.'
                  });
                } else if (desktopNotificationPermission === 'denied') {
                  addToast?.({
                    type: 'warning',
                    title: 'Notifications Blocked',
                    description: 'Please click the site permissions icon in your browser address bar to enable notifications.'
                  });
                } else {
                  const res = await requestDesktopNotificationPermission?.();
                  if (res === 'granted') {
                    addToast?.({
                      type: 'success',
                      title: 'Windows Notifications Enabled',
                      description: 'You will now receive desktop popups for incoming direct messages.'
                    });
                  }
                }
              }}
              className="relative h-8 w-8 flex items-center justify-center rounded-md transition-colors border border-subtle bg-surface text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
              title={
                desktopNotificationPermission === 'granted'
                  ? 'Windows Notifications: Active (Click to send test popup)'
                  : desktopNotificationPermission === 'denied'
                  ? 'Windows Notifications: Blocked in browser settings'
                  : 'Enable Windows Desktop Notifications'
              }
              aria-label="Windows desktop notifications"
            >
              {desktopNotificationPermission === 'denied' ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {desktopNotificationPermission === 'granted' && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
              {desktopNotificationPermission === 'default' && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-muted" />
              )}
            </button>

            {/* Notification Preferences Modal Toggle */}
            <button
              onClick={() => setNotificationSettingsModalOpen?.(true)}
              className="h-8 w-8 flex items-center justify-center rounded-md transition-colors border border-subtle bg-surface text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
              title="Notification preferences & privacy"
              aria-label="Notification preferences"
            >
              <Sliders className="h-3.5 w-3.5 text-secondary" />
            </button>

            {/* Main-Admin Schedule Daily Updates Action in #updates */}
            {isUpdates && currentUser?.role === 'main_admin' && (
              <button
                onClick={() => setScheduleUpdateModalOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-md transition-colors border border-subtle bg-surface text-secondary hover:text-primary hover:bg-surface-hover cursor-pointer"
                title="Schedule daily update requests (Alarm Clock)"
                aria-label="Schedule daily update requests"
              >
                <Clock className="h-4 w-4" />
              </button>
            )}

            {/* Search in Conversation */}
            <button
              onClick={() => setInChatSearchOpen(!inChatSearchOpen)}
              className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors border cursor-pointer ${
                inChatSearchOpen
                  ? 'bg-surface-hover text-primary border-focus'
                  : 'bg-surface text-secondary hover:text-primary hover:bg-surface-hover border-subtle'
              }`}
              title="Search conversation (⌘F)"
              aria-label="Search conversation"
            >
              <Search className="h-4 w-4 text-secondary" />
            </button>

            {/* Unified Details Panel Toggle (Pins, Files, Members) */}
            <button
              onClick={() => setPinnedDrawerOpen(!pinnedDrawerOpen)}
              className={`relative h-8 w-8 flex items-center justify-center rounded-md transition-colors border cursor-pointer ${
                pinnedDrawerOpen
                  ? 'bg-surface-hover text-primary border-focus'
                  : 'bg-surface text-secondary hover:text-primary hover:bg-surface-hover border-subtle'
              }`}
              title="Conversation details"
              aria-label="Conversation details"
            >
              <PanelRight className="h-4 w-4 text-secondary" />
              {pinnedCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 px-1 rounded-full text-xs font-mono font-bold bg-accent text-white flex items-center justify-center">
                  {pinnedCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Desktop Notification Prompt Banner */}
        {desktopNotificationPermission === 'default' && !bannerDismissed && (
          <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b border-subtle bg-surface text-primary">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-6 w-6 rounded-full bg-surface-hover text-secondary flex items-center justify-center shrink-0 border border-subtle">
                <Bell className="h-3.5 w-3.5" />
              </div>
              <span className="truncate">
                Get notified of new personal messages with <strong>Windows desktop popups</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  const res = await requestDesktopNotificationPermission?.();
                  if (res === 'granted') {
                    addToast?.({
                      type: 'success',
                      title: 'Windows Notifications Enabled',
                      description: 'A test popup has been dispatched to your screen.'
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-md bg-accent hover:bg-accent-hover text-white font-medium transition-colors cursor-pointer"
              >
                Turn on desktop notifications
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded text-muted hover:text-primary transition-colors cursor-pointer"
                title="Dismiss"
                aria-label="Dismiss notification prompt"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* In-Chat Search Bar */}
        <InChatSearchBar
          isOpen={inChatSearchOpen}
          onClose={() => setInChatSearchOpen(false)}
          onSelectMessage={id => {
            setSelectedMessageId(id);
            const el = document.getElementById(`msg-${id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          currentMatchIndex={0}
          matchingMessageIds={[]}
        />

        {/* 2. Main Content: Locked State or Message Stream & Composer */}
        {!isCurrentConversationAccessible ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-canvas">
            <div className="h-16 w-16 rounded-2xl bg-surface-hover border border-subtle flex items-center justify-center text-muted mb-4 shadow-sm">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold tracking-tight mb-2 text-primary">
              You are not authorized to access this
            </h2>
            <p className="text-xs max-w-md leading-relaxed text-secondary mb-6">
              {inaccessibilityReason || 'Access to this channel is restricted by Role-Based Access Control (RBAC). Only members of this department and Main Admin (CEO) have access.'}
            </p>
            <button
              onClick={() => {
                const myChan = getUserDepartmentChannel(channels, currentUser);
                setActiveConversationId(myChan);
              }}
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <span>Go to My Department</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            {/* 2. Chat Message Stream */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 bg-transparent custom-scrollbar"
            >
              <div ref={messagesContentRef} className="flex flex-col pb-6">
                {/* Empty State when no messages */}
                {currentMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 my-10">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3 bg-surface border border-subtle text-secondary">
                      {isAnnouncement ? <Megaphone className="h-6 w-6" /> : isUpdates ? <Sparkles className="h-6 w-6" /> : <Hash className="h-6 w-6" />}
                    </div>
                    <h2 className="font-bold text-base text-primary">
                      {isDm ? `Direct Message with ${headerTitle}` : `Welcome to ${headerTitle}`}
                    </h2>
                    <p className="text-xs max-w-sm mt-1 leading-relaxed text-secondary">
                      {isDm
                        ? `This is the direct end-to-end encrypted thread with ${headerTitle}.`
                        : headerSubtitle}
                    </p>
                    <p className="text-xs mt-2 font-mono text-muted">
                      {isAnnouncement && currentUser.role !== 'main_admin'
                        ? 'Only Main-Admin (CEO) has posting authorization in this channel.'
                        : 'Send a message below to start collaborating.'}
                    </p>
                  </div>
                ) : (
                  currentMessages.map((msg: any, index: number) => {
                    const sender = users.find(u => u.id === msg.senderId) || currentUser;
                    const prevMsg = currentMessages[index - 1];
                    const isFirstOfDay = !prevMsg || getDayKey(prevMsg.timestamp) !== getDayKey(msg.timestamp);
                    const isGrouped = !isFirstOfDay && Boolean(
                      prevMsg &&
                      prevMsg.senderId === msg.senderId &&
                      (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < 5 * 60 * 1000
                    );

                    return (
                      <React.Fragment key={msg.id}>
                        {isFirstOfDay && (
                          <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-1 rounded-full font-semibold text-xs uppercase tracking-wider bg-surface text-secondary border border-subtle">
                              {formatDateDivider(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <MessageItem
                          message={msg}
                          sender={sender}
                          isOwnMessage={msg.senderId === currentUser.id}
                          isHighlighted={msg.id === selectedMessageId}
                          isGrouped={isGrouped}
                        />
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-2 w-full shrink-0" />
              </div>

              {/* Floating Jump to Latest Button if user scrolled up */}
              {showScrollToBottomButton && (
                <div className="sticky bottom-2 flex justify-end pointer-events-none pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      isUserScrolledUpRef.current = false;
                      setShowScrollToBottomButton(false);
                      executeScrollToBottom(true);
                    }}
                    className="pointer-events-auto px-3 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-white shadow-md flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-subtle"
                    aria-label="Scroll to newest messages"
                    title="Scroll to newest messages"
                  >
                    <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
                    <span>Latest messages</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Message Composer */}
            <MessageInput />
          </>
        )}

        {/* 4. Fast Reply Popup */}
        <QuickReplyPopup />

        {/* 5. Notification Preferences & Privacy Modal */}
        <NotificationSettingsModal />
      </div>
    </TooltipProvider>
  );
};
