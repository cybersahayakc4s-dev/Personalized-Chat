import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { api } from '../../services/api';
import {
  Search,
  Hash,
  MessageSquare,
  Palette,
  Shield,
  X,
  ArrowRight,
  Sparkles,
  Command,
  Lock,
  LogIn,
  LogOut,
  Users,
  FileText,
  Loader2,
  Image as ImageIcon,
  Film,
  Music,
  Download,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { isChannelAuthorized } from '../../utils/rbac';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterCategory = 'all' | 'messages' | 'files' | 'channels' | 'colleagues' | 'actions';

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const highlightMatch = (text: string, q: string): React.ReactNode => {
  if (!q.trim() || !text) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-accent-muted text-accent font-semibold px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    visibleChannels,
    users,
    messages,
    currentUser,
    setActiveConversationId,
    createOrOpenDm,
    setAdminModalOpen,
    setLoginModalOpen,
    logout,
    theme,
    setTheme,
    openUnauthorizedModal,
    setHighlightedMessageId
  } = useChat() as any;

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<{ messages: any[]; files: any[] }>({
    messages: [],
    files: []
  });
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const isDark = theme !== 'light';

  // Focus input and reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedCategory('all');
      setSelectedIndex(0);
      setRemoteResults({ messages: [], files: [] });
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  // Debounced remote backend search for historical messages and attachments
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteResults({ messages: [], files: [] });
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const abortController = new AbortController();

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.search(trimmed, abortController.signal);
        if (res && typeof res === 'object') {
          setRemoteResults({
            messages: Array.isArray(res.messages) ? res.messages : [],
            files: Array.isArray(res.files) ? res.files : []
          });
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        console.warn('Backend message & file search error:', err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearchingRemote(false);
        }
      }
    }, 200);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      abortController.abort();
    };
  }, [query]);

  // Build searchable items organized by category
  const { items, counts } = useMemo(() => {
    const q = query.trim().toLowerCase();

    const channelItems: Array<any> = [];
    const colleagueItems: Array<any> = [];
    const messageItems: Array<any> = [];
    const fileItems: Array<any> = [];
    const actionItems: Array<any> = [];

    // Helper: resolve robust canonical conversation ID for remote search results
    const resolveConversationId = (item: any): string => {
      let cid = item.conversation_id;
      if (cid) {
        // Normalize team channel hyphens e.g. c-team_ai -> c-team-ai, c-hr_admin -> c-hr-admin
        if (cid.startsWith('c-')) {
          cid = cid.replace(/_/g, '-');
        }
        // Normalize single-user DM e.g. dm-2 to dm-1-2
        if (cid.startsWith('dm-') && !cid.slice(3).includes('-')) {
          const otherNum = Number(cid.replace('dm-', '')) || 0;
          const curNum = Number(String(currentUser?.id || '').replace('usr_', '')) || 1;
          if (otherNum) {
            cid = `dm-${Math.min(curNum, otherNum)}-${Math.max(curNum, otherNum)}`;
          }
        }
        return cid;
      }

      if (item.chat_type === 'team' || item.team) {
        const t = String(item.team || '').toLowerCase();
        if (t === 'team_ai' || t === 'team-ai') return 'c-team-ai';
        if (t === 'team_legal' || t === 'team-legal') return 'c-team-legal';
        if (t === 'hr_admin' || t === 'hr-admin') return 'c-hr-admin';
        if (t === 'seo') return 'c-seo';
        if (t === 'coordination') return 'c-coordination';
        return `c-${t.replace(/_/g, '-')}`;
      }

      if (item.chat_type === 'dm' || item.receiver_id || item.sender_id) {
        const curNum = Number(String(currentUser?.id || '').replace('usr_', '')) || 1;
        const sNum = Number(String(item.sender_id || '').replace('usr_', '')) || 0;
        const rNum = Number(String(item.receiver_id || '').replace('usr_', '')) || 0;
        const otherNum = sNum && sNum !== curNum ? sNum : rNum && rNum !== curNum ? rNum : (sNum || rNum);
        if (otherNum) {
          return `dm-${Math.min(curNum, otherNum)}-${Math.max(curNum, otherNum)}`;
        }
      }

      if (item.format === 'channel:updates' || item.chat_title === 'updates') {
        return 'c-updates';
      }

      return 'c-announcements';
    };

    // 1. Channels
    for (const ch of visibleChannels) {
      if (!q || ch.name.toLowerCase().includes(q) || (ch.description && ch.description.toLowerCase().includes(q))) {
        const accessCheck = isChannelAuthorized(ch, currentUser);
        const isAuthorized = accessCheck.authorized;

        channelItems.push({
          id: `ch-${ch.id}`,
          title: `#${ch.name}${!isAuthorized ? ' (Locked)' : ''}`,
          highlightedTitle: (
            <span>
              #{highlightMatch(ch.name, q)}
              {!isAuthorized && <span className="text-rose-400 ml-1.5 text-xs">(Locked)</span>}
            </span>
          ),
          subtitle: ch.description || (ch.team ? `${ch.team} department` : 'Company channel'),
          category: 'Channels',
          icon: !isAuthorized ? (
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
          ) : ch.type === 'team' ? (
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Hash className="w-4 h-4 text-blue-500 shrink-0" />
          ),
          action: () => {
            if (!isAuthorized) {
              openUnauthorizedModal(
                ch.name,
                ch.team,
                accessCheck.reason || 'This channel is restricted to authorized department personnel.'
              );
              onClose();
              return;
            }
            setActiveConversationId(ch.id);
            onClose();
          }
        });
      }
    }

    // 2. Colleagues
    for (const u of users) {
      if (u.id === currentUser.id) continue;
      if (u.account_status === 'deleted' || u.status === 'deleted' || u.name === '[Deleted User]') continue;
      if (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q))) {
        colleagueItems.push({
          id: `usr-${u.id}`,
          title: u.name,
          highlightedTitle: highlightMatch(u.name, q),
          subtitle: `@${u.handle} • ${u.title || 'Team Member'} (${u.status})`,
          category: 'Colleagues',
          icon: <Avatar user={u} size="xs" showStatus={true} />,
          action: () => {
            createOrOpenDm(u.id);
            onClose();
          }
        });
      }
    }

    // 3. Messages (Local active messages + remote historical database results)
    const seenMessageIds = new Set<string>();

    // Scan local in-memory messages
    if (q.length >= 1) {
      for (const m of messages) {
        if (!m.content || m.isDeleted) continue;
        if (m.content.toLowerCase().includes(q)) {
          const mIdStr = String(m.id);
          seenMessageIds.add(mIdStr);
          seenMessageIds.add(`msg-${mIdStr}`);

          const sender = users.find((u: any) => u.id === m.senderId);
          const channel = visibleChannels.find((c: any) => c.id === m.conversationId);
          const isDm = m.conversationId.startsWith('dm-');
          const chatTitle = isDm ? `DM with ${sender?.name || 'User'}` : (channel?.name ? `#${channel.name}` : m.conversationId);

          messageItems.push({
            id: `msg-${m.id}`,
            rawId: m.id,
            conversationId: m.conversationId,
            title: m.content,
            highlightedTitle: highlightMatch(m.content.length > 90 ? m.content.slice(0, 90) + '...' : m.content, q),
            subtitle: `${sender?.name || 'User'} in ${chatTitle} • ${new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
            category: 'Messages',
            hasAttachment: Boolean(m.attachments && m.attachments.length > 0),
            icon: <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />,
            action: () => {
              setActiveConversationId(m.conversationId);
              if (setHighlightedMessageId) {
                setHighlightedMessageId(m.id);
              }
              onClose();
            }
          });
        }
      }


      // Merge remote database search results
      for (const rm of remoteResults.messages) {
        const rmIdStr = String(rm.id);
        if (seenMessageIds.has(rmIdStr) || seenMessageIds.has(`msg-${rmIdStr}`)) continue;
        seenMessageIds.add(rmIdStr);

        const convId = resolveConversationId(rm);

        messageItems.push({
          id: `remote-msg-${rm.id}`,
          rawId: rm.id,
          conversationId: convId,
          title: rm.content || 'Message match',
          highlightedTitle: highlightMatch(rm.content && rm.content.length > 90 ? rm.content.slice(0, 90) + '...' : (rm.content || 'Message match'), q),
          subtitle: `${rm.sender_name || 'User'} in ${rm.chat_title || 'Chat'} • ${rm.created_at ? new Date(rm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}`,
          category: 'Messages',
          hasAttachment: Boolean(rm.has_attachments || rm.attachment_count > 0),
          icon: <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />,
          action: () => {
            setActiveConversationId(convId);
            if (setHighlightedMessageId) {
              setHighlightedMessageId(String(rm.id));
            }
            onClose();
          }
        });
      }
    }

    // 4. Files & Media (Local uploaded attachments + remote database attachments)
    const seenFileIds = new Set<string>();

    // Scan local attachments
    for (const m of messages) {
      if (m.attachments && Array.isArray(m.attachments)) {
        for (const att of m.attachments) {
          const fileId = `att-${att.id}`;
          if (seenFileIds.has(fileId)) continue;

          const isImg = att.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(att.name);
          const isVid = att.type?.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(att.name);
          const isAud = att.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(att.name);
          const isPdf = att.type?.includes('pdf') || /\.pdf$/i.test(att.name);

          const matchesQuery = !q ||
            att.name.toLowerCase().includes(q) ||
            (att.type && att.type.toLowerCase().includes(q)) ||
            (q === 'image' && isImg) ||
            (q === 'video' && isVid) ||
            (q === 'audio' && isAud) ||
            (q === 'pdf' && isPdf) ||
            (q === 'file' || q === 'files');

          if (matchesQuery) {
            seenFileIds.add(fileId);
            const sender = users.find((u: any) => u.id === m.senderId);
            const channel = visibleChannels.find((c: any) => c.id === m.conversationId);
            const isDm = m.conversationId.startsWith('dm-');
            const chatTitle = isDm ? `DM with ${sender?.name || 'User'}` : (channel?.name ? `#${channel.name}` : m.conversationId);

            fileItems.push({
              id: fileId,
              title: att.name,
              highlightedTitle: highlightMatch(att.name, q),
              fileSize: formatBytes(att.size),
              downloadUrl: att.downloadUrl || att.url,
              fileUrl: att.url,
              isImage: isImg,
              subtitle: `${formatBytes(att.size)} • Shared by ${sender?.name || 'User'} in ${chatTitle}`,
              category: 'Files',
              icon: isImg ? (
                <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : isVid ? (
                <Film className="w-4 h-4 text-purple-400 shrink-0" />
              ) : isAud ? (
                <Music className="w-4 h-4 text-cyan-400 shrink-0" />
              ) : isPdf ? (
                <FileText className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              ),
              action: () => {
                setActiveConversationId(m.conversationId);
                if (setHighlightedMessageId) {
                  setHighlightedMessageId(m.id);
                }
                onClose();
              }
            });
          }
        }
      }
    }

    // Merge remote database attachment search results
    for (const rf of remoteResults.files) {
      const rfIdStr = `remote-att-${rf.id}`;
      if (seenFileIds.has(rfIdStr) || seenFileIds.has(`att-${rf.id}`)) continue;
      seenFileIds.add(rfIdStr);

      const isImg = rf.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(rf.file_name);
      const isVid = rf.mime_type?.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(rf.file_name);
      const isAud = rf.mime_type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(rf.file_name);
      const isPdf = rf.mime_type?.includes('pdf') || /\.pdf$/i.test(rf.file_name);

      const convId = resolveConversationId(rf);

      fileItems.push({
        id: rfIdStr,
        title: rf.file_name,
        highlightedTitle: highlightMatch(rf.file_name, q),
        fileSize: formatBytes(rf.file_size_bytes),
        downloadUrl: rf.download_url,
        fileUrl: rf.url,
        isImage: isImg,
        subtitle: `${formatBytes(rf.file_size_bytes)} • Shared by ${rf.sender_name || 'User'} in ${rf.chat_title || 'Conversation'}`,
        category: 'Files',
        icon: isImg ? (
          <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : isVid ? (
          <Film className="w-4 h-4 text-purple-400 shrink-0" />
        ) : isAud ? (
          <Music className="w-4 h-4 text-cyan-400 shrink-0" />
        ) : isPdf ? (
          <FileText className="w-4 h-4 text-rose-400 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
        ),
        action: () => {
          setActiveConversationId(convId);
          if (setHighlightedMessageId && rf.message_id) {
            setHighlightedMessageId(String(rf.message_id));
          }
          onClose();
        }
      });
    }

    // 5. Quick Actions
    if (!q || 'theme'.includes(q) || 'dark'.includes(q) || 'light'.includes(q)) {
      actionItems.push({
        id: 'act-theme',
        title: `Switch Theme: Current ${theme === 'dark' ? 'Dark Mode' : 'Light Mode'}`,
        highlightedTitle: `Switch Theme: Current ${theme === 'dark' ? 'Dark Mode' : 'Light Mode'}`,
        subtitle: 'Toggle between soft pale cobalt light mode and sleek obsidian dark mode',
        category: 'Actions',
        icon: <Palette className="w-4 h-4 text-amber-500 shrink-0" />,
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
          onClose();
        }
      });
    }

    if (!q || 'sign'.includes(q) || 'out'.includes(q) || 'logout'.includes(q) || 'leave'.includes(q)) {
      actionItems.push({
        id: 'act-logout',
        title: 'Sign Out of Workspace',
        highlightedTitle: 'Sign Out of Workspace',
        subtitle: `End session for ${currentUser.name} (@${currentUser.handle})`,
        category: 'Actions',
        icon: <LogOut className="w-4 h-4 text-danger shrink-0" />,
        action: () => {
          logout?.();
          onClose();
        }
      });
    }

    if (currentUser.role === 'main_admin' && (!q || 'admin'.includes(q) || 'console'.includes(q))) {
      actionItems.push({
        id: 'act-admin',
        title: 'Open Admin Console',
        highlightedTitle: 'Open Admin Console',
        subtitle: 'Provision accounts, team policies & security audit logs',
        category: 'Actions',
        icon: <Shield className="w-4 h-4 text-indigo-500 shrink-0" />,
        action: () => {
          setAdminModalOpen(true);
          onClose();
        }
      });
    }

    const countsMap = {
      all: channelItems.length + colleagueItems.length + messageItems.length + fileItems.length + actionItems.length,
      messages: messageItems.length,
      files: fileItems.length,
      channels: channelItems.length,
      colleagues: colleagueItems.length,
      actions: actionItems.length
    };

    let filteredItems: Array<any> = [];
    if (selectedCategory === 'all') {
      filteredItems = [...fileItems, ...messageItems, ...channelItems, ...colleagueItems, ...actionItems];
    } else if (selectedCategory === 'messages') {
      filteredItems = messageItems;
    } else if (selectedCategory === 'files') {
      filteredItems = fileItems;
    } else if (selectedCategory === 'channels') {
      filteredItems = channelItems;
    } else if (selectedCategory === 'colleagues') {
      filteredItems = colleagueItems;
    } else if (selectedCategory === 'actions') {
      filteredItems = actionItems;
    }

    return {
      items: filteredItems,
      counts: countsMap
    };
  }, [
    visibleChannels,
    users,
    messages,
    currentUser,
    query,
    theme,
    isDark,
    selectedCategory,
    remoteResults,
    setActiveConversationId,
    createOrOpenDm,
    setAdminModalOpen,
    setLoginModalOpen,
    setTheme,
    openUnauthorizedModal,
    setHighlightedMessageId,
    onClose
  ]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  // Keep selected item scrolled into view
  useEffect(() => {
    if (listRef.current && listRef.current.children[selectedIndex]) {
      (listRef.current.children[selectedIndex] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-16 px-2 sm:px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-2xl overflow-hidden flex flex-col max-h-[82vh] transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3"
        >
          {isSearchingRemote ? (
            <Loader2 className="w-5 h-5 text-[var(--brand-primary)] animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-[var(--brand-primary)] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages, files (png, pdf, mp4), channels (#ai), or colleagues..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-hidden font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Chips with Live Badges */}
        <div
          className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] flex items-center justify-between gap-1.5 text-xs"
        >
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'messages', label: 'Messages', count: counts.messages },
              { id: 'files', label: 'Files & Media', count: counts.files },
              { id: 'channels', label: 'Channels', count: counts.channels },
              { id: 'colleagues', label: 'Colleagues', count: counts.colleagues },
              { id: 'actions', label: 'Actions', count: counts.actions }
            ].map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id as FilterCategory);
                    setSelectedIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover'
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.count > 0 && (
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-surface-hover text-secondary border border-subtle'
                      }`}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-hover text-secondary active:bg-surface-hover text-xs font-sans font-medium shrink-0 ml-1 border border-subtle cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {items.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted space-y-2">
              <p className="font-medium text-sm">
                {query ? `No matches found for "${query}" in ${selectedCategory}.` : 'Search across all workspace messages, files, and channels.'}
              </p>
              <p className="text-xs text-muted">
                Try searching for keyword terms like <code className="text-secondary font-mono">image</code>, <code className="text-secondary font-mono">pdf</code>, <code className="text-secondary font-mono">video</code>, or channel names like <code className="text-secondary font-mono">#ai</code>.
              </p>
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isFile = item.category === 'Files';
              const isMessage = item.category === 'Messages';

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-surface-hover text-primary font-medium shadow-xs border border-focus'
                      : 'text-primary hover:bg-surface-hover bg-surface border border-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center border border-subtle">
                      {item.icon}
                    </div>

                    <div className="truncate flex-1 min-w-0">
                      <div className="text-xs truncate font-semibold flex items-center gap-2">
                        <span className="truncate">{item.highlightedTitle || item.title}</span>
                        {isMessage && item.hasAttachment && (
                          <span className={`inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${
                            isSelected ? 'bg-accent-muted text-accent border border-accent/20' : 'bg-surface-hover text-secondary border border-subtle'
                          }`}>
                            <Paperclip className="w-2.5 h-2.5" />
                            File
                          </span>
                        )}
                      </div>

                      {item.subtitle && (
                        <div className="text-xs truncate mt-0.5 text-secondary">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Category Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isFile && item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        download={item.title}
                        onClick={e => e.stopPropagation()}
                        className={`p-1.5 rounded-md transition flex items-center gap-1 text-xs ${
                          isSelected
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-[var(--bg-surface-hover)] text-[var(--brand-primary)] hover:bg-[var(--brand-primary)] hover:text-white border border-[var(--border-subtle)]'
                        }`}
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline font-mono text-xs">Download</span>
                      </a>
                    )}

                    <span
                      className={`text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {item.category}
                    </span>

                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white animate-in fade-in" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard Footer Hint */}
        <div
          className="p-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] flex items-center justify-between text-xs font-mono"
        >
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]">↑</kbd>
              <kbd className="px-1 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)] ml-1">↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]">↵</kbd> jump to chat
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]">esc</kbd> close
            </span>
          </div>
          <span className="hidden sm:inline text-xs text-[var(--text-muted)] font-sans">
            Universal Search
          </span>
        </div>
      </div>
    </div>
  );
};
