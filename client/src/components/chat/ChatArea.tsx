import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';

import { useChat } from '../../context/ChatContext';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { InChatSearchBar } from './InChatSearchBar';
import { Avatar } from '../common/Avatar';
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
  X
} from 'lucide-react';
import { getUserDepartmentChannel } from '../../utils/rbac';
import { formatDateDivider, getDayKey } from '../../utils/date';
import { QuickReplyPopup } from './QuickReplyPopup';
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
    addToast
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
      (m: any) => m.conversationId === activeConversationId && !m.replyToId
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
    const memberCount = channelData.team ? users.filter((u: any) => u.team === channelData.team).length : users.length;
    headerSubtitle = isTeam ? `Department • ${memberCount} member${memberCount === 1 ? '' : 's'}` : `Channel • ${memberCount} member${memberCount === 1 ? '' : 's'}`;
  }

  const isDark = theme !== 'nordic';

  return (
    <div className={`flex-1 flex flex-col h-full ${isDark ? 'bg-[#121620] text-[#E2E8F0]' : 'bg-[#D8DFE7] text-slate-800'} overflow-hidden min-w-0 transition-colors`}>
      {/* 1. Application Header (Channel / DM Title & Quick Actions) */}
      <header className={`h-16 border-b ${isDark ? 'border-[#222C3E] bg-[#161D2B]' : 'border-[#C6D0DC] bg-[#E4EAF2]'} px-3 sm:px-6 flex items-center justify-between flex-shrink-0 select-none transition-colors electron-drag`}>
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
          <button
            onClick={() => setSidebarMobileOpen(true)}
            className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'} lg:hidden`}
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {isDm ? (
            <Avatar
              user={otherUser || ({ name: headerTitle, status: 'online', team: 'team_ai' } as any)}
              size="md"
              showStatus={true}
            />
          ) : (
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shadow-xs ${
              isAnnouncement ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
              isUpdates ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
              'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
            }`}>
              {isAnnouncement ? <Megaphone className="w-4 h-4" /> : isUpdates ? <Sparkles className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className={`font-semibold text-base tracking-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {headerTitle}
              </h1>
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-2 mt-0.5 truncate`}>
              {isDm ? (
                <div className="flex items-center gap-1.5 truncate">
                  <span>@{otherUser?.handle || 'user'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      otherUser?.status === 'online'
                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                        : otherUser?.status === 'busy'
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                    }`} />
                    <span className={
                      otherUser?.status === 'online'
                        ? 'text-emerald-400 font-medium'
                        : otherUser?.status === 'busy'
                        ? 'text-amber-400 font-medium'
                        : 'text-slate-400'
                    }>
                      {otherUser?.status === 'online' ? 'Online' : otherUser?.status === 'busy' ? 'Busy' : 'Offline'}
                    </span>
                  </span>
                </div>
              ) : (
                <span className="truncate">{headerSubtitle}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Actions: Icon-only buttons for Search, Notifications, and Details Panel */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Windows Desktop Notifications Quick Toggle / Test */}
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
            className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors border ${
              desktopNotificationPermission === 'granted'
                ? isDark
                  ? 'bg-[#182030] hover:bg-[#202B40] text-emerald-400 border-emerald-500/30'
                  : 'bg-[#EAEFF5] hover:bg-[#DEE5EE] text-emerald-600 border-emerald-500/30'
                : desktopNotificationPermission === 'denied'
                ? isDark
                  ? 'bg-rose-950/30 text-rose-400 border-rose-800/40'
                  : 'bg-rose-50 text-rose-600 border-rose-200'
                : isDark
                ? 'bg-[#182030] hover:bg-[#202B40] text-amber-400 border-amber-500/30'
                : 'bg-[#EAEFF5] hover:bg-[#DEE5EE] text-amber-600 border-amber-500/30'
            }`}
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
              <BellOff className="w-4 h-4" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {desktopNotificationPermission === 'granted' && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
            )}
            {desktopNotificationPermission === 'default' && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* Notification Preferences Modal Toggle */}
          <button
            onClick={() => setNotificationSettingsModalOpen?.(true)}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors border ${
              isDark
                ? 'bg-[#182030] hover:bg-[#202B40] text-slate-300 border-[#2A364E]'
                : 'bg-[#EAEFF5] hover:bg-[#DEE5EE] text-slate-700 border-[#C6D0DC] shadow-2xs'
            }`}
            title="Notification preferences & privacy"
            aria-label="Notification preferences"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Search in Conversation */}
          <button
            onClick={() => setInChatSearchOpen(!inChatSearchOpen)}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors border ${
              inChatSearchOpen
                ? 'bg-[#1C2638] text-white border-[#2D3C54] shadow-xs'
                : isDark
                ? 'bg-[#182030] hover:bg-[#202B40] text-slate-300 border-[#2A364E]'
                : 'bg-[#EAEFF5] hover:bg-[#DEE5EE] text-slate-700 border-[#C6D0DC] shadow-2xs'
            }`}
            title="Search conversation (⌘F)"
            aria-label="Search conversation"
          >
            <Search className="w-4 h-4 text-slate-400" />
          </button>

          {/* Unified Details Panel Toggle (Pins, Files, Members) */}
          <button
            onClick={() => setPinnedDrawerOpen(!pinnedDrawerOpen)}
            className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors border ${
              pinnedDrawerOpen
                ? 'bg-[#1C2638] text-white border-[#2D3C54] shadow-xs'
                : isDark
                ? 'bg-[#182030] hover:bg-[#202B40] text-slate-300 border-[#2A364E]'
                : 'bg-[#EAEFF5] hover:bg-[#DEE5EE] text-slate-700 border-[#C6D0DC] shadow-2xs'
            }`}
            title="Conversation details"
            aria-label="Conversation details"
          >
            <PanelRight className="w-4 h-4 text-slate-400" />
            {pinnedCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-slate-900 flex items-center justify-center shadow-xs">
                {pinnedCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* WhatsApp-style Desktop Notification Prompt Banner */}
      {desktopNotificationPermission === 'default' && !bannerDismissed && (
        <div className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b ${
          isDark
            ? 'bg-[#1A2333] border-[#2A364E] text-slate-200'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5" />
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
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-xs cursor-pointer"
            >
              Turn on desktop notifications
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss notification prompt"
            >
              <X className="w-3.5 h-3.5" />
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
        <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${isDark ? 'bg-[#18181B]' : 'bg-[#F8F9FA]'}`}>
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className={`text-lg font-bold tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            You are not authorized to access this
          </h2>
          <p className={`text-xs max-w-md leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
            {inaccessibilityReason || 'Access to this channel is restricted by Role-Based Access Control (RBAC). Only members of this department and Main Admin (CEO) have access.'}
          </p>
          <button
            onClick={() => {
              const myChan = getUserDepartmentChannel(channels, currentUser);
              setActiveConversationId(myChan);
            }}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md cursor-pointer hover:brightness-110"
          >
            <span>Go to My Department</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* 2. Chat Message Stream */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className={`relative flex-1 overflow-y-auto px-4 sm:px-6 py-4 ${isDark ? 'bg-[#121620]' : 'bg-[#D8DFE7]'}`}
          >
            <div ref={messagesContentRef} className="space-y-4 pb-6">
              {/* Empty State when no messages */}
              {currentMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-8 my-10">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-2xs ${
                    isDark ? 'bg-[#131B2E] border border-[#1E293B] text-blue-400' : 'bg-blue-50 border border-blue-100 text-blue-600'
                  }`}>
                    {isAnnouncement ? <Megaphone className="w-6 h-6" /> : isUpdates ? <Sparkles className="w-6 h-6" /> : <Hash className="w-6 h-6" />}
                  </div>
                  <h2 className="font-bold text-base">
                    {isDm ? `Direct Message with ${headerTitle}` : `Welcome to ${headerTitle}`}
                  </h2>
                  <p className={`text-xs max-w-sm mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isDm
                      ? `This is the direct end-to-end encrypted thread with ${headerTitle}.`
                      : headerSubtitle}
                  </p>
                  <p className={`text-[11px] mt-2 font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
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

                  return (
                    <React.Fragment key={msg.id}>
                      {isFirstOfDay && (
                        <div className="flex items-center justify-center my-3">
                          <span className={`px-3.5 py-1 rounded-full font-semibold text-[11px] uppercase tracking-wider shadow-2xs ${
                            isDark ? 'bg-[#182030] text-slate-300 border border-[#253248]' : 'bg-[#EAEFF5] text-slate-700 border border-[#C6D0DC] shadow-xs'
                          }`}>
                            {formatDateDivider(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <MessageItem
                        message={msg}
                        sender={sender}
                        isOwnMessage={msg.senderId === currentUser.id}
                        isHighlighted={msg.id === selectedMessageId}
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
                  className="pointer-events-auto px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer border border-blue-400/30 backdrop-blur-xs"
                  aria-label="Scroll to newest messages"
                  title="Scroll to newest messages"
                >
                  <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                  <span>Latest messages</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Message Composer */}
          <MessageInput />
        </>
      )}

      {/* 4. WhatsApp-style Fast Reply Popup */}
      <QuickReplyPopup />

      {/* 5. Notification Preferences & Privacy Modal */}
      <NotificationSettingsModal />
    </div>
  );
};
