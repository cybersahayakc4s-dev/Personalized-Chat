import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../common/Avatar';
import { TeamBadge, RoleBadge } from '../common/Badge';
import { MessageItem } from './MessageItem';
import {
  X,
  Pin,
  Users,
  FileText,
  Download,
  Image,
  FileCode,
  FileArchive,
  File as FileIcon,
  MessageSquare
} from 'lucide-react';
import { User, Attachment } from '../../types';
import { getServerBaseUrl } from '../../services/api';
import { getTeamNameFromConversationId } from '../../utils/rbac';

const resolveMediaUrl = (url?: string): string => {
  if (!url || url === '#') return '#';
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = getServerBaseUrl() || (typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8000');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
};

export const RightSidebar: React.FC = () => {
  const {
    rightSidebarOpen,
    setRightSidebarOpen,
    pinnedDrawerOpen,
    setPinnedDrawerOpen,
    messages,
    users,
    currentUser,
    activeConversationId,
    activeConversation,
    isDm,
    createOrOpenDm,
    setProfileModalUser,
    theme,
    channels
  } = useChat() as any;

  const isOpen = rightSidebarOpen || pinnedDrawerOpen;
  if (!isOpen) return null;

  const handleClose = () => {
    if (setRightSidebarOpen) setRightSidebarOpen(false);
    if (setPinnedDrawerOpen) setPinnedDrawerOpen(false);
  };

  const isDark = theme !== 'nordic';

  // 1. Current conversation messages
  const currentMessages = (messages || []).filter(
    (m: any) => m.conversationId === activeConversationId
  );

  // 2. Pinned messages
  const pinnedMessages = currentMessages.filter((m: any) => m.isPinned);

  // 3. Shared Files (List view, extracting all attachments)
  const sharedFiles: Array<Attachment & { senderName: string; timestamp: string; messageId: string }> = [];
  currentMessages.forEach((m: any) => {
    if (m.attachments && m.attachments.length > 0) {
      const sender = (users || []).find((u: any) => u.id === m.senderId);
      m.attachments.forEach((att: Attachment) => {
        sharedFiles.push({
          ...att,
          senderName: sender?.name || 'User',
          timestamp: m.timestamp,
          messageId: m.id
        });
      });
    }
  });

  // 4. Relevant Members (Filtered to active users only; strictly isolated for department channels)
  const activeUsers = (users || []).filter((u: any) =>
    u.account_status !== 'deleted' &&
    u.status !== 'deleted' &&
    !u.is_deleted &&
    !u.name?.includes('[Deleted User]') &&
    !(u.email && u.email?.includes('@archived.internal'))
  );

  const teamChannelTeam = !isDm && ((activeConversation as any)?.type === 'team' || (activeConversation as any)?.team)
    ? ((activeConversation as any)?.team || getTeamNameFromConversationId(channels || [], activeConversation?.id))
    : null;

  const channelMembers: User[] = !isDm
    ? teamChannelTeam
      ? activeUsers.filter((u: any) => u.team === teamChannelTeam || u.role === 'main_admin')
      : activeUsers
    : [];

  const displayedMembers: User[] = channelMembers;

  const getFileIcon = (fileName: string = '', type: string = '') => {
    const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || type?.startsWith('image/')) {
      return <Image className="w-4 h-4 text-sky-400 flex-shrink-0" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'html', 'css'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-400 flex-shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden cursor-pointer animate-in fade-in duration-150"
      />
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 w-full sm:w-80 lg:w-[clamp(280px,28vw,350px)] max-w-full border-l ${
          isDark ? 'border-[#222C3E] bg-[#121620] text-[#E2E8F0]' : 'border-[#C6D0DC] bg-[#E4EAF2] text-slate-800'
        } flex flex-col h-full animate-in slide-in-from-right duration-200 shadow-2xl lg:shadow-none flex-shrink-0 select-none transition-colors`}>
        {/* Header (aligned with ChatArea h-16 header) */}
        <div
          className={`h-16 px-5 border-b ${
            isDark ? 'border-[#222C3E] bg-[#161D2B]' : 'border-[#C6D0DC] bg-[#DCE3EB]'
          } flex items-center justify-between flex-shrink-0`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={`font-semibold text-sm tracking-tight truncate ${isDark ? 'text-[#F1F5F9]' : 'text-slate-900'}`}>
              {isDm ? 'Direct Chat Details' : 'Conversation Details'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className={`p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800 active:bg-slate-700' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-200 active:bg-slate-300'
            }`}
            title="Close panel"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Body: 3 Organized Sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-inherit">
        
        {/* SECTION 1: PINNED MESSAGES */}
        <div className="p-3.5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Pin className="w-3.5 h-3.5 text-amber-400" />
              <span>Pinned Messages</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {pinnedMessages.length}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {pinnedMessages.length === 0 ? (
              <div className={`p-4 text-center rounded-lg border border-dashed ${
                isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-400'
              }`}>
                <p className="text-xs font-medium">No pinned messages</p>
                <p className="text-[11px] mt-0.5">Hover any message and click pin to save it here</p>
              </div>
            ) : (
              pinnedMessages.map((msg: any) => {
                const sender = (users || []).find((u: any) => u.id === msg.senderId) || currentUser;
                return (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-lg border text-xs transition ${
                      isDark ? 'bg-[#182030] border-[#253247]' : 'bg-[#EAEFF5] border-[#C6D0DC]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {sender.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`line-clamp-3 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {msg.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 2: MEMBERS OF THE CHAT (Only for Channels / Groups; Omitted in 1:1 DMs) */}
        {!isDm && (
          <div className="p-3.5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Members of the Chat</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium font-mono ${
                isDark ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
              }`}>
                {channelMembers.length}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {displayedMembers.map((member: User) => {
                const isMe = member.id === currentUser?.id;
                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-1.5 rounded-md transition ${
                      isDark ? 'hover:bg-[#182030]' : 'hover:bg-[#DEE5EE]'
                    }`}
                  >
                    <button
                      onClick={() => setProfileModalUser(member)}
                      className="flex items-center gap-2 min-w-0 text-left flex-1"
                    >
                      <Avatar user={member} size="xs" showStatus={true} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {member.name}
                          </span>
                          {isMe && <span className="text-[10px] text-slate-500 font-mono">(you)</span>}
                          {member.role === 'main_admin' && (
                            <span className="text-[9px] px-1 rounded font-mono bg-blue-500/20 text-blue-300 font-semibold">
                              CEO
                            </span>
                          )}
                          {member.is_team_leader && member.role !== 'main_admin' && (
                            <span className="text-[9px] px-1 rounded font-mono bg-indigo-500/20 text-indigo-300 font-semibold">
                              Lead
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate font-mono">
                          @{member.handle}
                        </div>
                      </div>
                    </button>

                    {!isMe && (
                      <button
                        onClick={() => createOrOpenDm(member.id)}
                        className={`p-1 rounded text-slate-400 hover:text-blue-400 ${
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
                        }`}
                        title={`Direct message @${member.handle}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: SHARED FILES & DOCUMENTS (List View) */}
        <div className="p-3.5 flex flex-col flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Shared Files & Documents</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-medium ${
                isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {sharedFiles.length}
            </span>
          </div>

          <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
            {sharedFiles.length === 0 ? (
              <div className={`p-4 text-center rounded-lg border border-dashed ${
                isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-400'
              }`}>
                <p className="text-xs font-medium">No files shared yet</p>
                <p className="text-[11px] mt-0.5">Attachments sent in this conversation will be listed here</p>
              </div>
            ) : (
              sharedFiles.map((file, idx) => (
                <div
                  key={`${file.id}-${idx}`}
                  className={`flex items-center justify-between p-2 rounded-lg border transition ${
                    isDark
                      ? 'bg-[#182030] border-[#253247] hover:border-[#384963]'
                      : 'bg-[#EAEFF5] border-[#C6D0DC] hover:bg-[#DEE5EE]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {getFileIcon(file?.name || '', file?.type || '')}
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`} title={file?.name || 'Attachment'}>
                        {file?.name || 'Attachment'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span className="truncate">{file.senderName}</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={resolveMediaUrl(file.downloadUrl || file.url)}
                    download={file.name}
                    className={`p-1.5 rounded-md transition-colors ml-2 flex-shrink-0 ${
                      isDark
                        ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </aside>
  </>
);
};
