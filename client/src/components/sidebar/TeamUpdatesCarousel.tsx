import React, { useState, useMemo } from 'react';
import { useChat } from '../../context/ChatContext';
import { TeamId, User, Message } from '../../types';
import { getDayKey, formatSidebarTime } from '../../utils/date';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, Sparkles } from 'lucide-react';

interface TeamItem {
  id: TeamId;
  name: string;
}

const TEAMS_LIST: TeamItem[] = [
  { id: 'team_ai', name: 'AI Team' },
  { id: 'team_legal', name: 'Legal' },
  { id: 'seo', name: 'SEO & Growth' },
  { id: 'coordination', name: 'Coordination' },
  { id: 'hr_admin', name: 'HR & Admin' },
];

export const TeamUpdatesCarousel: React.FC<{ onOpenScheduler?: () => void }> = ({ onOpenScheduler }) => {
  const {
    messages = [],
    users = [],
    setActiveConversationId,
    setHighlightedMessageId
  } = useChat() as any;

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
    <div className="mx-2 mb-3 p-2.5 rounded-lg border transition-colors select-none bg-surface border-subtle">
      {/* Header: Title + Counter + Schedule Button */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-subtle">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-secondary shrink-0" />
          <span className="font-semibold text-xs text-primary tracking-tight truncate">
            Team Updates
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-sidebar-active text-secondary border border-sidebar-border">
            {postedCount}/{TEAMS_LIST.length} posted
          </span>

          {onOpenScheduler && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduler();
              }}
              className="p-1 rounded text-secondary hover:text-primary hover:bg-sidebar-hover transition-colors cursor-pointer"
              title="Schedule daily update request"
              aria-label="Schedule daily update request"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Team Card Content */}
      <div
        onClick={handleCardClick}
        className={`p-2.5 rounded-md border transition-colors cursor-pointer ${
          updateData
            ? 'bg-sidebar-active border-sidebar-border hover:border-focus'
            : 'bg-sidebar border-sidebar-border hover:bg-sidebar-hover'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${updateData ? 'bg-primary' : 'bg-muted'}`}
            />
            <span className="font-semibold text-xs text-primary truncate">
              {updateData?.author ? `${updateData.author.name} — ` : ''}{currentTeam.name}
            </span>
          </div>

          <span className="text-xs font-mono text-muted shrink-0">
            {updateData ? formatSidebarTime(updateData.message.timestamp) : 'Pending'}
          </span>
        </div>

        {updateData ? (
          <div>
            <p className={`text-xs text-secondary leading-relaxed font-sans ${isExpanded ? '' : 'line-clamp-2'}`}>
              {updateData.message.content || '[Attachment update posted]'}
            </p>
            {updateData.message.content && updateData.message.content.length > 80 && (
              <button
                type="button"
                onClick={toggleExpand}
                className="mt-1 text-xs font-medium text-primary hover:underline transition-colors cursor-pointer block"
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-1 text-muted italic text-xs font-mono">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>No updates posted today</span>
          </div>
        )}
      </div>

      {/* Carousel Controls: Previous Arrow, Dots, Next Arrow */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-1">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1 rounded text-secondary hover:text-primary hover:bg-sidebar-hover transition-colors cursor-pointer"
          title="Previous team"
          aria-label="Previous team"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
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
                className={`h-2 w-2 rounded-full transition-all cursor-pointer ${
                  hasPosted ? 'bg-primary' : 'bg-transparent border border-focus'
                } ${
                  isSelected ? 'ring-2 ring-focus scale-125' : 'hover:opacity-80'
                }`}
                title={`${team.name}: ${hasPosted ? 'Posted today' : 'No update today'}`}
                aria-label={`${team.name}: ${hasPosted ? 'Posted today' : 'No update today'}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="p-1 rounded text-secondary hover:text-primary hover:bg-sidebar-hover transition-colors cursor-pointer"
          title="Next team"
          aria-label="Next team"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
