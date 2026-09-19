import React from 'react';
import { ChatProvider, useChat } from './context/ChatContext';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { ThreadDrawer } from './components/chat/ThreadDrawer';
import { RightSidebar } from './components/chat/RightSidebar';
import { AdminConsoleModal } from './components/admin/AdminConsoleModal';
import { NewDmModal } from './components/modals/NewDmModal';
import { NewChannelModal } from './components/modals/NewChannelModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { LoginModal } from './components/modals/LoginModal';
import { UnauthorizedModal } from './components/modals/UnauthorizedModal';
import { ScheduleUpdateModal } from './components/modals/ScheduleUpdateModal';

import { CommandPalette } from './components/modals/CommandPalette';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ActivityDrawer } from './components/chat/ActivityDrawer';
import { SettingsModal } from './components/modals/SettingsModal';

function ChatApp() {
  const {
    theme,
    themePreset,
    commandPaletteOpen,
    setCommandPaletteOpen,
    toasts,
    dismissToast,
    addToast,
    scheduleUpdateModalOpen,
    setScheduleUpdateModalOpen,
    isAuthenticated
  } = useChat() as any;

  const isDark = theme !== 'light';

  // Sync theme attribute, meta theme-color, data-preset, and dark class on documentElement and body
  React.useEffect(() => {
    const activePreset = themePreset || (isDark ? 'dark_cyber_indigo' : 'oceanic_corporate');

    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
      document.body.setAttribute('data-theme', 'light');
    }

    document.documentElement.setAttribute('data-preset', activePreset);
    document.body.setAttribute('data-preset', activePreset);

    const canvasColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim();
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    if (canvasColor) {
      metaTheme.setAttribute('content', canvasColor);
    }
  }, [theme, themePreset, isDark]);

  // Global Cmd+K / Ctrl+K listener for Command Palette (Universal Search)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  // Automated Daily Updates Alarm Checker
  React.useEffect(() => {
    const checkDailyAlarm = () => {
      try {
        const isEnabled = localStorage.getItem('chat_daily_update_enabled');
        if (isEnabled === 'false') return;

        const targetTime = localStorage.getItem('chat_daily_update_time') || '18:00';
        const [targetH, targetM] = targetTime.split(':').map(Number);
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const lastFired = localStorage.getItem('chat_daily_update_last_fired');

        if (lastFired !== todayKey) {
          if (currentH > targetH || (currentH === targetH && currentM >= targetM)) {
            localStorage.setItem('chat_daily_update_last_fired', todayKey);
            const promptMsg =
              localStorage.getItem('chat_daily_update_msg') ||
              'Please submit your daily end-of-day updates, milestones, and blockers in #updates.';

            if (addToast) {
              addToast({
                type: 'info',
                title: '⏰ Daily Team Update Reminder',
                description: promptMsg
              });
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('⏰ Daily Team Update Reminder', {
                  body: promptMsg,
                  icon: '/favicon.ico',
                  tag: 'daily-update-reminder'
                });
              } catch (e) {
                // ignore
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    };

    checkDailyAlarm();
    const interval = setInterval(checkDailyAlarm, 30000);
    return () => clearInterval(interval);
  }, [addToast]);

  // Security Gate: If not authenticated, require login first (cannot access or peek at chat workspace)
  if (!isAuthenticated) {
    return (
      <div
        data-theme={isDark ? 'dark' : 'light'}
        data-preset={themePreset || (isDark ? 'dark_cyber_indigo' : 'oceanic_corporate')}
        className="flex h-screen w-screen bg-canvas text-primary font-sans overflow-hidden items-center justify-center p-4 selection:bg-accent selection:text-white"
      >
        <LoginModal isStandalone={true} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      data-preset={themePreset || (isDark ? 'dark_cyber_indigo' : 'oceanic_corporate')}
      className="flex h-screen w-screen bg-canvas text-primary font-sans overflow-hidden selection:bg-accent selection:text-white"
    >
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Chat Workspace */}
      <main className="flex-1 flex overflow-hidden min-w-0 bg-canvas">
        <ChatArea />
        <ThreadDrawer />
        <RightSidebar />
      </main>

      {/* Floating Application Modals */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <AdminConsoleModal />
      <NewDmModal />
      <NewChannelModal />
      <UserProfileModal />
      <LoginModal />
      <UnauthorizedModal />
      <ScheduleUpdateModal
        isOpen={scheduleUpdateModalOpen}
        onClose={() => setScheduleUpdateModalOpen(false)}
      />

      {/* Persistent Non-Blocking Toasts */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />

      {/* Activity & Mentions Drawer */}
      <ActivityDrawer />

      {/* Workspace Preferences & Settings Modal */}
      <SettingsModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ChatProvider>
        <ChatApp />
      </ChatProvider>
    </ErrorBoundary>
  );
}
