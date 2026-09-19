import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Clock, Check, X, Megaphone, Sparkles, CheckCircle2 } from 'lucide-react';

interface ScheduleUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_TIMES = [
  { label: '5:00 PM', value: '17:00' },
  { label: '5:30 PM', value: '17:30' },
  { label: '6:00 PM', value: '18:00' },
  { label: '6:30 PM', value: '18:30' },
  { label: '7:00 PM', value: '19:00' },
];

export const ScheduleUpdateModal: React.FC<ScheduleUpdateModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    sendMessage,
    addToast,
    theme
  } = useChat() as any;

  const isDark = theme !== 'light';

  // Load persisted settings
  const [scheduledTime, setScheduledTime] = useState(() => {
    return localStorage.getItem('chat_daily_update_time') || '18:00';
  });
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('chat_daily_update_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [customPrompt, setCustomPrompt] = useState(() => {
    return (
      localStorage.getItem('chat_daily_update_msg') ||
      'Please submit your daily end-of-day updates, progress, and blockers in #updates.'
    );
  });
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Format 24h to 12h display
  const formatTimeDisplay = (time24: string) => {
    if (!time24) return '6:00 PM';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  };

  const handleSaveSchedule = () => {
    localStorage.setItem('chat_daily_update_time', scheduledTime);
    localStorage.setItem('chat_daily_update_enabled', String(isEnabled));
    localStorage.setItem('chat_daily_update_msg', customPrompt);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);

    if (addToast) {
      addToast({
        type: 'success',
        title: 'Daily Schedule Updated',
        description: isEnabled
          ? `Automated update reminder set for ${formatTimeDisplay(scheduledTime)} daily.`
          : 'Automated daily update reminder disabled.'
      });
    }
  };

  const handleBroadcastNow = async () => {
    setIsBroadcasting(true);
    try {
      // 1. Send desktop notification if available
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('⏰ Daily Team Update Reminder', {
            body: customPrompt,
            icon: '/favicon.ico',
            tag: 'team-update-reminder'
          });
        } catch (e) {
          // ignore notification error
        }
      }

      // 2. Dispatch high-visibility Toast
      if (addToast) {
        addToast({
          type: 'info',
          title: '⏰ Daily Team Update Request',
          description: `${currentUser?.name || 'Main-Admin'} requested daily updates: "${customPrompt}"`
        });
      }

      // 3. Post prompt to #updates channel
      if (sendMessage) {
        await sendMessage(
          `📢 **End-of-Day Team Update Request**\n\n${customPrompt}\n\n*All team leads and members, please post your team's summary below.*`,
          undefined,
          undefined,
          'channel:updates'
        );
      }

      if (addToast) {
        addToast({
          type: 'success',
          title: 'Broadcast Dispatched',
          description: 'Update request sent to all workspace members in #updates.'
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to broadcast update reminder:', err);
      if (addToast) {
        addToast({
          type: 'error',
          title: 'Broadcast Error',
          description: 'Failed to send update request.'
        });
      }
    } finally {
      setIsBroadcasting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg p-6 rounded-2xl shadow-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-default animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-subtle mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-muted border border-accent text-accent flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-primary">Schedule Daily Updates</h3>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-surface-hover text-secondary border border-subtle">
                  #updates
                </span>
              </div>
              <p className="text-xs mt-0.5 text-secondary">
                Configure daily alarm reminder and broadcast update requests to all teams.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-hover transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alarm Clock Card */}
        <div className="p-4 rounded-xl border border-subtle bg-surface-hover mb-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-secondary font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Target Schedule Time
              </span>
              <div className="text-2xl font-bold font-mono text-primary mt-1 tracking-tight">
                {formatTimeDisplay(scheduledTime)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg font-mono text-sm font-bold bg-canvas border border-subtle text-primary focus:border-focus"
              />
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-subtle">
            <span className="text-xs text-muted font-mono mr-1">Quick Presets:</span>
            {PRESET_TIMES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setScheduledTime(p.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer ${
                  scheduledTime === p.value
                    ? 'bg-accent text-white font-bold shadow-xs'
                    : 'bg-canvas text-secondary hover:bg-surface hover:text-primary border border-subtle'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reminder Enable Switch */}
        <div className="p-3.5 rounded-xl border border-subtle bg-surface-hover flex items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-xs font-semibold block text-primary">
              Automated Daily Reminder Active
            </span>
            <p className="text-xs text-secondary mt-0.5">
              Notifies all workspace members at {formatTimeDisplay(scheduledTime)} every day.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-hover peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-subtle after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* Message Prompt */}
        <div className="mb-5">
          <label className="block mb-1.5 text-xs font-semibold text-primary">
            Notification Prompt Message
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            placeholder="Write reminder instructions for all teams..."
            className="w-full p-2.5 rounded-lg border border-subtle bg-canvas text-primary placeholder:text-muted text-xs leading-relaxed focus:border-focus resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-subtle">
          <button
            type="button"
            onClick={handleBroadcastNow}
            disabled={isBroadcasting}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface-hover hover:bg-surface text-primary border border-subtle font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            title="Dispatch immediate reminder to all workspace users"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast to Workspace Now'}</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-xs text-secondary hover:text-primary hover:bg-surface-hover transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSchedule}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              {justSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>{justSaved ? 'Saved!' : 'Save Schedule'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
