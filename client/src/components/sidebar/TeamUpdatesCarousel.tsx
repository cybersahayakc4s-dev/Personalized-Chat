import React, { useState, useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import { TeamId, User, Message } from '../../types';
import { TEAMS_META } from '../../data/initialData';
import { getDayKey, formatSidebarTime } from '../../utils/date';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface TeamItem {
  id: TeamId;
  name: string;
  dotColor: string;
}

const TEAMS_LIST: TeamItem[] = [
  { id: 'team_ai', name: 'AI Team', dotColor: '#6366f1' },
  { id: 'team_legal', name: 'Legal', dotColor: '#f59e0b' },
  { id: 'seo', name: 'SEO & Growth', dotColor: '#06b6d4' },
  { id: 'coordination', name: 'Coordination', dotColor: '#f43f5e' },
  { id: 'hr_admin', name: 'HR & Admin', dotColor: '#10b981' },
];

export const TeamUpdatesCarousel: React.FC<{ onOpenScheduler?: () => void }> = ({ onOpenScheduler }) => {
  const {
    messages = [],
    users = [],
    setActiveConversationId,
    setHighlightedMessageId,
    theme
  } = useChat() as any;

  const isDark = theme !== 'nordic';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const todayKey = getDayKey(new Date().toISOString());

  // Aggregate today's updates per team from #updates channel
  const { teamUpdates, postedCount } = useMemo(() => {
    const map: Record<string, { message: Message; author?: User }> = {};

    // Filter messages belonging to #updates sent today
    const updatesMsgs = messages.filter((m: Message) => {
      const isUpdates = m.conversationId === 'c-updates' || m.format === 'channel:updates';
      const isToday = getDayKey(m.timestamp) === todayKey;
      return isUpdates && isToday && !m.isDeleted;
    });

    // Match messages to teams
    for (const team of TEAMS_LIST) {
      const teamMsg = updatesMsgs
        .filter((m: Message) => {
          if ((m as any).team === team.id) return true;
          const author = users.find((u: User) => u.id === m.senderId);
          return author?.team === team.id;
        })
        .sort((a: Message, b: Message) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      if (teamMsg) {
        const author = users.find((u: User) => u.id === teamMsg.senderId);
        map[team.id] = { message: teamMsg, author };
      }
    }

    const count = Object.keys(map).length;
    return { teamUpdates: map, postedCount: count };
  }, [messages, users, todayKey]);

  const currentTeam = TEAMS_LIST[currentIndex] || TEAMS_LIST[0];
  const updateData = teamUpdates[currentTeam.id];
  const isExpanded = Boolean(expandedCards[currentTeam.id]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + TEAMS_LIST.length) % TEAMS_LIST.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % TEAMS_LIST.length);
  };

  const handleCardClick = () => {
    if (updateData?.message) {
      setActiveConversationId('c-updates');
      setHighlightedMessageId(updateData.message.id);
    } else {
      setActiveConversationId('c-updates');
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCards(prev => ({
      ...prev,
      [currentTeam.id]: !prev[currentTeam.id]
    }));
  };

  return (
    <div className="mx-2 mb-3 p-2.5 rounded-xl border transition-colors select-none bg-[#101726] border-slate-800/90 shadow-sm">
      {/* Header: Title + Counter + Alarm Clock Schedule Button */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-xs text-white tracking-tight truncate">
            Team Updates
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {postedCount}/{TEAMS_LIST.length} posted
          </span>

          {onOpenScheduler && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduler();
              }}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
              title="Schedule daily update request"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Team Card Content */}
      <div
        onClick={handleCardClick}
        className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
          updateData
            ? 'bg-[#152033] border-blue-500/30 hover:border-blue-400 hover:bg-[#18253c]'
            : 'bg-slate-900/50 border-slate-800/60 hover:bg-slate-900/80'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentTeam.dotColor }}
            />
            <span className="font-semibold text-xs text-slate-200 truncate">
              {updateData?.author ? `${updateData.author.name} — ` : ''}{currentTeam.name}
            </span>
          </div>

          <span className="text-[10px] font-mono text-slate-400 shrink-0">
            {updateData ? formatSidebarTime(updateData.message.timestamp) : 'Pending'}
          </span>
        </div>

        {updateData ? (
          <div>
            <p className={`text-xs text-slate-300 leading-relaxed font-sans ${isExpanded ? '' : 'line-clamp-2'}`}>
              {updateData.message.content || '[Attachment update posted]'}
            </p>
            {updateData.message.content && updateData.message.content.length > 80 && (
              <button
                type="button"
                onClick={toggleExpand}
                className="mt-1 text-[10.5px] font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer block"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-1 text-slate-500 italic text-[11px] font-mono">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>No updates posted today</span>
          </div>
        )}
      </div>

      {/* Carousel Controls: Previous Arrow, Color-coded Dots, Next Arrow */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-1">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Previous team"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Dot Indicators */}
        <div className="flex items-center gap-1.5">
          {TEAMS_LIST.map((team, idx) => {
            const hasPosted = Boolean(teamUpdates[team.id]);
            const isSelected = idx === currentIndex;
            return (
              <button
                key={team.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-white/60 scale-125' : 'hover:opacity-80'
                }`}
                style={{
                  backgroundColor: hasPosted ? team.dotColor : 'transparent',
                  border: hasPosted ? 'none' : '1px solid #475569'
                }}
                title={`${team.name}: ${hasPosted ? 'Posted today' : 'No update today'}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Next team"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
