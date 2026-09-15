import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  Bell,
  Volume2,
  VolumeX,
  EyeOff,
  Clock,
  Check,
  X,
  Sparkles,
  Info,
  ExternalLink,
  Minimize2
} from 'lucide-react';
import { NotificationScope } from '../../types';

export const NotificationSettingsModal: React.FC = () => {
  const {
    notificationSettingsModalOpen,
    setNotificationSettingsModalOpen,
    notificationPreferences,
    updateNotificationPreferences,
    desktopNotificationPermission,
    requestDesktopNotificationPermission,
    sendTestDesktopNotification,
    theme
  } = useChat() as any;

  const [minimizedCountdown, setMinimizedCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (minimizedCountdown === null) return;
    if (minimizedCountdown <= 0) {
      setMinimizedCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setMinimizedCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [minimizedCountdown]);

  if (!notificationSettingsModalOpen) return null;

  const isDark = theme !== 'nordic';

  const scopes: { id: NotificationScope; label: string; desc: string }[] = [
    {
      id: 'all',
      label: 'All Messages (Recommended for Workspaces)',
      desc: 'Windows popup for every incoming message across personal 1:1 DMs and all department channels.'
    },
    {
      id: 'dms_and_mentions',
      label: 'DMs & Direct @Mentions Only',
      desc: 'Popups for personal 1:1 messages and direct @mentions. Filters out general channel chatter.'
    },
    {
      id: 'dms_only',
      label: 'Direct Messages Only',
      desc: 'Only popups for private 1:1 direct messages. Zero channel notifications.'
    }
  ];

  const handleTestMinimized = () => {
    setMinimizedCountdown(4);
    sendTestDesktopNotification(4000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setNotificationSettingsModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default ${
          isDark ? 'bg-[#151D2A] border-[#2A3852] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Notification Preferences</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Customize Windows desktop popups, privacy, and audio alerts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNotificationSettingsModalOpen(false)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white active:bg-slate-700' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800 active:bg-slate-200'
            }`}
            title="Close modal (Tap outside to close)"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Permission Status Banner */}
          <div className={`p-4 rounded-xl border flex flex-col gap-3 text-xs ${
            desktopNotificationPermission === 'granted'
              ? isDark ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : desktopNotificationPermission === 'denied'
              ? isDark ? 'bg-rose-950/30 border-rose-800/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
              : isDark ? 'bg-amber-950/30 border-amber-800/40 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  desktopNotificationPermission === 'granted' ? 'bg-emerald-400 animate-pulse' : desktopNotificationPermission === 'denied' ? 'bg-rose-400' : 'bg-amber-400'
                }`} />
                <span className="font-semibold text-xs">
                  Windows System Status:{' '}
                  {desktopNotificationPermission === 'granted'
                    ? 'Active & Allowed'
                    : desktopNotificationPermission === 'denied'
                    ? 'Blocked in Browser'
                    : 'Pending Permission'}
                </span>
              </div>

              {desktopNotificationPermission !== 'granted' && (
                <button
                  onClick={requestDesktopNotificationPermission}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Allow Notifications
                </button>
              )}
            </div>

            {desktopNotificationPermission === 'granted' && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-800/20">
                <button
                  onClick={() => sendTestDesktopNotification(0)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Send Immediate Popup
                </button>
                <button
                  onClick={handleTestMinimized}
                  disabled={minimizedCountdown !== null}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  {minimizedCountdown !== null
                    ? `Minimize now! Fires in ${minimizedCountdown}s...`
                    : 'Test Minimized Popup (Fires in 4s)'}
                </button>
              </div>
            )}
          </div>

          {/* Scope Radio Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Notification Trigger Scope
            </label>
            <div className="space-y-2">
              {scopes.map(s => {
                const selected = (notificationPreferences.scope || 'all') === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateNotificationPreferences({ scope: s.id })}
                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      selected
                        ? isDark
                          ? 'bg-blue-600/15 border-blue-500/50 text-white'
                          : 'bg-blue-50 border-blue-300 text-blue-950'
                        : isDark
                        ? 'bg-[#182232] border-[#26354D] text-slate-300 hover:border-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                      selected ? 'border-blue-500 bg-blue-500' : 'border-slate-500'
                    }`}>
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs">{s.label}</div>
                      <div className={`text-[11px] mt-0.5 ${selected ? (isDark ? 'text-blue-300/80' : 'text-blue-800/80') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                        {s.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggles: Privacy Mode, Sound, Startup Catch-Up */}
          <div className="space-y-3 pt-3 border-t border-slate-700/40 dark:border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Privacy & Experience Controls
            </label>

            {/* Privacy Mode */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-[#182232] border-[#26354D]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-xs">Desk Privacy Mode</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Hides message content from Windows popups if colleagues walk past your desk.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(notificationPreferences.privacyMode)}
                onChange={e => updateNotificationPreferences({ privacyMode: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Sound Chime */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-[#182232] border-[#26354D]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  {notificationPreferences.soundEnabled !== false ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-medium text-xs">Notification Sound Chime</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Play subtle audio alert on new incoming message.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notificationPreferences.soundEnabled !== false}
                onChange={e => updateNotificationPreferences({ soundEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Missed Messages on Startup */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-[#182232] border-[#26354D]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-xs">Missed Messages Catch-Up on Boot</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Show a summary toast of missed messages when laptop turns on and app launches.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(notificationPreferences.missedMessagesOnStartup)}
                onChange={e => updateNotificationPreferences({ missedMessagesOnStartup: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Windows System Troubleshooting Info Box */}
          <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
            isDark ? 'bg-[#121A26] border-[#223046] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Windows Notification Checklist (If popups don't appear):</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 text-[11px] leading-relaxed text-slate-400">
              <li>
                <strong className="text-slate-200">Windows Focus Assist / Do Not Disturb:</strong> Check bottom-right of your Windows taskbar (bell/moon icon). If "Focus Assist" or "Do Not Disturb" is turned ON, Windows suppresses all bottom popups into Action Center.
              </li>
              <li>
                <strong className="text-slate-200">Windows Settings &gt; System &gt; Notifications &gt; Google Chrome:</strong> Verify Chrome is toggled ON and "Show notification banners" is checked.
              </li>
              <li>
                <strong className="text-slate-200">Browser Permissions:</strong> Look at the URL address bar; verify the lock icon shows Notifications set to "Allowed".
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-700/50 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={() => setNotificationSettingsModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
