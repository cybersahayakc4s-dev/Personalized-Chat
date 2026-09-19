import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import {
  X,
  Check,
  Volume2,
  VolumeX,
  EyeOff,
  Laptop,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  Server,
  Sun,
  Moon,
  Palette
} from 'lucide-react';
import { NotificationScope } from '../../types';
import { isElectron, getElectronApi, UpdaterState } from '../../utils/electron';

export const SettingsModal: React.FC = () => {
  const {
    notificationSettingsModalOpen,
    setNotificationSettingsModalOpen,
    theme,
    setTheme,
    themePreset,
    setThemePreset,
    fontSize,
    setFontSize,
    hideScrollbars,
    setHideScrollbars,
    notificationPreferences,
    updateNotificationPreferences,
    sendTestDesktopNotification,
    chatGradient,
    setChatGradient
  } = useChat() as any;

  const [activeTab, setActiveTab] = useState<'appearance' | 'notifications' | 'desktop'>('appearance');
  const [minimizedCountdown, setMinimizedCountdown] = useState<number | null>(null);

  // Desktop Updater state
  const [appVersion, setAppVersion] = useState<string>('3.1.1');
  const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);

  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronApi();
    if (api?.getAppVersion) {
      api.getAppVersion().then(v => {
        if (v) setAppVersion(v);
      }).catch(() => { });
    }
    if (api?.getUpdaterState) {
      api.getUpdaterState().then(s => {
        if (s) setUpdaterState(s);
      }).catch(() => { });
    }
    if (api?.onUpdaterStatus) {
      const unsub = api.onUpdaterStatus((state) => {
        setUpdaterState(state);
        if (state.status !== 'checking') {
          setIsCheckingUpdate(false);
        }
      });
      return unsub;
    }
  }, []);

  const handleCheckUpdate = async () => {
    const api = getElectronApi();
    if (!api?.checkForUpdates) return;
    setIsCheckingUpdate(true);
    try {
      const res = await api.checkForUpdates();
      if (!res?.ok && res?.message) {
        setIsCheckingUpdate(false);
      }
    } catch (e) {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = () => {
    const api = getElectronApi();
    if (api?.installUpdate) {
      api.installUpdate();
    }
  };

  if (!notificationSettingsModalOpen) return null;

  const handleTestMinimized = () => {
    setMinimizedCountdown(4);
    sendTestDesktopNotification(4000);
  };

  const scopes: { id: NotificationScope; label: string; desc: string }[] = [
    {
      id: 'all',
      label: 'All Messages',
      desc: 'Popups for every incoming message across 1:1 direct messages and allowed team channels.'
    },
    {
      id: 'dms_and_mentions',
      label: 'DMs & Direct Mentions Only',
      desc: 'Popups for personal 1:1 messages and direct @mentions. Filters out general channel chatter.'
    },
    {
      id: 'dms_only',
      label: 'Direct Messages Only',
      desc: 'Only popups for private 1:1 direct messages. Zero channel notifications.'
    }
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setNotificationSettingsModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[85vh] bg-surface text-primary cursor-default"
      >
        {/* Clean Header */}
        <div className="px-6 py-4 border-b border-subtle flex items-center justify-between bg-surface">
          <div>
            <h2 className="font-semibold text-sm text-primary tracking-tight">Preferences</h2>
            <p className="text-xs text-muted mt-0.5">
              Workspace typography, layout density, and notification controls
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationSettingsModalOpen(false)}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Minimalist Segmented Tab Navigation */}
        <div className="px-6 pt-3 pb-2 flex gap-1.5 border-b border-subtle bg-surface">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${activeTab === 'appearance'
                ? 'bg-surface-hover text-primary font-semibold shadow-xs'
                : 'text-secondary hover:text-primary'
              }`}
          >
            Appearance & Density
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${activeTab === 'notifications'
                ? 'bg-surface-hover text-primary font-semibold shadow-xs'
                : 'text-secondary hover:text-primary'
              }`}
          >
            Notifications & Sound
          </button>
          {isElectron() && (
            <button
              onClick={() => setActiveTab('desktop')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'desktop'
                  ? 'bg-surface-hover text-primary font-semibold shadow-xs'
                  : 'text-secondary hover:text-primary'
                }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Desktop & Updates</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'appearance' ? (
            <>
              {/* Theme Mode & Quadrant Color Palettes */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-accent" />
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted block">
                      Theme Color Palette
                    </label>
                  </div>
                  {/* Mode switcher toggle */}
                  <div className="flex items-center gap-1 p-0.5 rounded-lg border border-subtle bg-surface">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${theme === 'light'
                          ? 'bg-surface-hover text-primary font-semibold shadow-xs'
                          : 'text-muted hover:text-primary'
                        }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${theme === 'dark'
                          ? 'bg-surface-hover text-primary font-semibold shadow-xs'
                          : 'text-muted hover:text-primary'
                        }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(theme === 'light'
                    ? [
                      {
                        id: 'oceanic_corporate',
                        name: 'Oceanic Corporate',
                        quadrant: 'Quadrant 1 • Business',
                        desc: 'Slate blue sidebar with electric blue highlights.',
                        sidebar: '#334155',
                        rail: '#1E293B',
                        accent: '#3B82F6',
                        fg: '#F1F5F9'
                      },
                      {
                        id: 'natural_executive',
                        name: 'Natural Executive',
                        quadrant: 'Quadrant 2 • Creative',
                        desc: 'Muted sage & deep forest green with bright mint.',
                        sidebar: '#2C4A3E',
                        rail: '#142E24',
                        accent: '#4ADE80',
                        fg: '#ECFDF5'
                      },
                      {
                        id: 'luxury_plum',
                        name: 'Luxury Plum & Charcoal',
                        quadrant: 'Quadrant 3 • Contemporary',
                        desc: 'Warm dark charcoal with soft orchid & lavender.',
                        sidebar: '#362A3C',
                        rail: '#1F1424',
                        accent: '#C084FC',
                        fg: '#F3E8FF'
                      },
                      {
                        id: 'midnight_cyber',
                        name: 'Midnight Cyber',
                        quadrant: 'Quadrant 4 • High Tech',
                        desc: 'Deep ocean teal-blue with cyber cyan.',
                        sidebar: '#1E3A52',
                        rail: '#0F172A',
                        accent: '#22D3EE',
                        fg: '#ECFEFF'
                      }
                    ]
                    : [
                      {
                        id: 'dark_cyber_indigo',
                        name: 'Dark Cyber Indigo',
                        quadrant: 'Quadrant 5 • Futuristic',
                        desc: 'Midnight indigo with vivid amethyst & violet.',
                        sidebar: '#161A2B',
                        rail: '#090A0F',
                        accent: '#8B5CF6',
                        fg: '#E2E8F0'
                      },
                      {
                        id: 'forest_obsidian',
                        name: 'Forest Obsidian & Mint',
                        quadrant: 'Quadrant 6 • Natural Dark',
                        desc: 'Dark pine with refreshing emerald & mint.',
                        sidebar: '#13211B',
                        rail: '#070F0A',
                        accent: '#10B981',
                        fg: '#D1FAE5'
                      },
                      {
                        id: 'premium_carbon',
                        name: 'Premium Carbon & Amber',
                        quadrant: 'Quadrant 7 • Executive',
                        desc: 'Deep graphite charcoal with warm gold amber.',
                        sidebar: '#1C1B1E',
                        rail: '#0D0D0E',
                        accent: '#D97706',
                        fg: '#E4E4E7'
                      },
                      {
                        id: 'midnight_steel',
                        name: 'Midnight Steel & Aqua',
                        quadrant: 'Quadrant 8 • Developer',
                        desc: 'Dark ocean steel with vibrant aqua & teal.',
                        sidebar: '#112233',
                        rail: '#080E14',
                        accent: '#06B6D4',
                        fg: '#E0F2FE'
                      }
                    ]
                  ).map((p) => {
                    const isSelected = themePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setThemePreset(p.id)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${isSelected
                            ? 'border-accent bg-surface-hover shadow-xs ring-1 ring-accent/40'
                            : 'border-subtle hover:border-focus bg-surface'
                          }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-primary">{p.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                          </div>
                          <span className="text-[10px] font-mono text-muted uppercase">{p.quadrant}</span>
                          <p className="text-xs text-muted mt-0.5 leading-snug">{p.desc}</p>
                        </div>

                        {/* Swatch row */}
                        <div className="flex items-center gap-2 pt-2 border-t border-subtle/50">
                          <span className="text-[10px] text-muted font-mono">Swatches:</span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                              style={{ backgroundColor: p.sidebar }}
                              title={`Sidebar: ${p.sidebar}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                              style={{ backgroundColor: p.rail }}
                              title={`Rail: ${p.rail}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                              style={{ backgroundColor: p.accent }}
                              title={`Accent: ${p.accent}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
                              style={{ backgroundColor: p.fg }}
                              title={`Text: ${p.fg}`}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Scaling */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 block">
                  Font Scaling
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'small', label: 'Compact', desc: '13.5px base' },
                    { id: 'medium', label: 'Normal', desc: '15px standard' },
                    { id: 'large', label: 'Spacious', desc: '16.5px base' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFontSize(f.id)}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${fontSize === f.id
                          ? 'border-accent bg-surface-hover shadow-xs'
                          : 'border-subtle hover:border-focus bg-surface'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-primary">{f.label}</span>
                        {fontSize === f.id && <Check className="w-3.5 h-3.5 text-accent" />}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollbars Appearance */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 block">
                  Scrollbar Behavior
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHideScrollbars(false)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${!hideScrollbars
                        ? 'border-accent bg-surface-hover shadow-xs'
                        : 'border-subtle hover:border-focus bg-surface'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-primary">Subtle Themed</span>
                      {!hideScrollbars && <Check className="w-3.5 h-3.5 text-accent" />}
                    </div>
                    <p className="text-xs text-muted mt-1 leading-normal">
                      Minimal dark tracks with hover feedback
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHideScrollbars(true)}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${hideScrollbars
                        ? 'border-accent bg-surface-hover shadow-xs'
                        : 'border-subtle hover:border-focus bg-surface'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-primary">Hidden</span>
                      {hideScrollbars && <Check className="w-3.5 h-3.5 text-accent" />}
                    </div>
                    <p className="text-xs text-muted mt-1 leading-normal">
                      Clean borderless scroll with zero visible tracks
                    </p>
                  </button>
                </div>
              </div>

              {/* Chat Background Gradient */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 block">
                  Chat Ambient Gradient
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cobalt', label: 'Cobalt Aurora', desc: 'Deep subtle indigo glow' },
                    { id: 'midnight', label: 'Midnight Slate', desc: 'Dark obsidian gradient' },
                    { id: 'emerald', label: 'Emerald Horizon', desc: 'Subtle teal reflection' },
                    { id: 'none', label: 'Pure Minimal', desc: 'Solid distraction-free background' }
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setChatGradient(g.id)}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${chatGradient === g.id
                          ? 'border-accent bg-surface-hover shadow-xs ring-1 ring-accent/30'
                          : 'border-subtle hover:border-focus bg-surface'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-primary">{g.label}</span>
                        {chatGradient === g.id && <Check className="w-3.5 h-3.5 text-accent" />}
                      </div>
                      <p className="text-xs text-muted mt-1 leading-normal">{g.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === 'notifications' ? (
            <>
              {/* Notification Scopes */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                  Delivery Scope
                </label>
                <div className="space-y-2">
                  {scopes.map(s => {
                    const active = notificationPreferences.scope === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => updateNotificationPreferences({ scope: s.id })}
                        className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${active
                            ? 'border-accent bg-surface-hover shadow-xs'
                            : 'border-subtle hover:border-focus bg-surface'
                          }`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-accent bg-accent text-white' : 'border-subtle'
                            }`}
                        >
                          {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-primary">{s.label}</p>
                          <p className="text-xs text-muted mt-0.5 leading-relaxed">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sound & Privacy */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  Sound & Privacy
                </label>

                {/* Sound Toggle */}
                <div
                  onClick={() => updateNotificationPreferences({ soundEnabled: !notificationPreferences.soundEnabled })}
                  className="p-3 rounded-lg border border-subtle hover:border-focus flex items-center justify-between cursor-pointer bg-surface"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-surface-hover border border-subtle flex items-center justify-center text-secondary">
                      {notificationPreferences.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-accent" /> : <VolumeX className="w-3.5 h-3.5 text-muted" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary">Audio Alerts</p>
                      <p className="text-xs text-muted">Play subtle sound on incoming messages</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.soundEnabled}
                    onChange={() => { }}
                    className="accent-accent cursor-pointer h-4 w-4"
                  />
                </div>

                {/* Privacy Mode */}
                <div
                  onClick={() => updateNotificationPreferences({ privacyMode: !notificationPreferences.privacyMode })}
                  className="p-3 rounded-lg border border-subtle hover:border-focus flex items-center justify-between cursor-pointer bg-surface"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-surface-hover border border-subtle flex items-center justify-center text-secondary">
                      <EyeOff className="w-3.5 h-3.5 text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary">Privacy Mode</p>
                      <p className="text-xs text-muted">Hide message preview text on desktop popups</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.privacyMode}
                    onChange={() => { }}
                    className="accent-accent cursor-pointer h-4 w-4"
                  />
                </div>
              </div>

              {/* Test Notification Action */}
              <div className="p-3 rounded-lg border border-subtle bg-surface-hover/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-primary">Test Desktop Popup</p>
                  <p className="text-xs text-muted">Sends a 4-second delayed desktop test alert</p>
                </div>
                <button
                  type="button"
                  onClick={handleTestMinimized}
                  disabled={minimizedCountdown !== null}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {minimizedCountdown !== null ? `Alerting in ${minimizedCountdown}s...` : 'Send Test Alert'}
                </button>
              </div>
            </>
          ) : (
            /* Desktop & Updates Tab */
            <div className="space-y-4">
              {/* Desktop App Status Card */}
              <div className="p-4 rounded-xl border border-subtle bg-surface-hover/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-primary">Personalize Chat Desktop</h3>
                      <p className="text-[11px] text-muted">Sovereign Windows Native Application</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface border border-subtle text-primary">
                    v{appVersion}
                  </span>
                </div>

                {/* Server info */}
                <div className="pt-2 border-t border-subtle/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Server className="w-3.5 h-3.5 text-accent" />
                    <span>Production Host</span>
                  </div>
                  <span className="font-mono text-[11px] text-primary">https://chat.cybersahayak.cloud</span>
                </div>
              </div>

              {/* Auto Updates Card */}
              <div className="p-4 rounded-xl border border-subtle bg-surface space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-primary">Application Updates</h4>
                    <p className="text-xs text-muted mt-0.5">
                      {updaterState?.status === 'downloaded'
                        ? 'A new version has been downloaded and is ready to install.'
                        : updaterState?.status === 'downloading'
                          ? 'Downloading latest update in background...'
                          : updaterState?.status === 'checking' || isCheckingUpdate
                            ? 'Checking update server...'
                            : updaterState?.status === 'error'
                              ? 'Unable to complete update check.'
                              : 'Your desktop application automatically checks for new releases.'}
                    </p>
                  </div>
                  <div className="shrink-0 ml-2">
                    {updaterState?.status === 'downloaded' ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : updaterState?.status === 'error' ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5" /> Error
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Progress bar if downloading */}
                {updaterState?.status === 'downloading' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-surface-hover rounded-full h-1.5 overflow-hidden border border-subtle">
                      <div
                        className="bg-accent h-full transition-all duration-300"
                        style={{ width: `${Math.round(updaterState.progress?.percent || 0)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted font-mono">
                      <span>Downloading...</span>
                      <span>{Math.round(updaterState.progress?.percent || 0)}%</span>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="pt-2 border-t border-subtle flex items-center justify-between">
                  <span className="text-[11px] text-muted">
                    Channel: <span className="text-primary font-medium">Production</span>
                  </span>
                  {updaterState?.status === 'downloaded' ? (
                    <button
                      type="button"
                      onClick={handleInstallUpdate}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Restart & Install Now
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCheckUpdate}
                      disabled={isCheckingUpdate || updaterState?.status === 'checking' || updaterState?.status === 'downloading'}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-hover hover:bg-surface-active text-primary border border-subtle transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${isCheckingUpdate || updaterState?.status === 'checking' ? 'animate-spin' : ''}`} />
                      {isCheckingUpdate || updaterState?.status === 'checking' ? 'Checking...' : 'Check for Updates'}
                    </button>
                  )}
                </div>
              </div>

              {/* Background Execution & Quick Reply Note */}
              <div className="p-3.5 rounded-xl border border-subtle bg-surface-hover/20 text-xs text-muted leading-relaxed space-y-1">
                <p className="font-semibold text-primary">System Tray & Background Notifications</p>
                <p>
                  Closing this window automatically hides the application to the Windows System Tray. When in the background, you will receive interactive floating Quick Reply notification banners without interrupting your workflow.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-subtle bg-surface flex items-center justify-end">
          <button
            type="button"
            onClick={() => setNotificationSettingsModalOpen(false)}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
