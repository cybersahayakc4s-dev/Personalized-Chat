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

import { CommandPalette } from './components/modals/CommandPalette';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function ChatApp() {
  const {
    theme,
    commandPaletteOpen,
    setCommandPaletteOpen,
    toasts,
    dismissToast,
    isAuthenticated
  } = useChat();

  // Sync theme attribute, meta theme-color, and dark class on documentElement and body
  React.useEffect(() => {
    const isDark = theme !== 'nordic';
    const themeColor = isDark ? '#121620' : '#D8DFE7';
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', themeColor);

    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', theme || 'slate');
      document.body.classList.add('dark');
      document.body.setAttribute('data-theme', theme || 'slate');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'nordic');
      document.body.classList.remove('dark');
      document.body.setAttribute('data-theme', 'nordic');
    }
  }, [theme]);

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

  // Security Gate: If not authenticated, require login first (cannot access or peek at chat workspace)
  if (!isAuthenticated) {
    return (
      <div
        data-theme={theme}
        className="flex h-screen w-screen bg-[var(--surface-base)] text-[var(--text-primary)] font-sans overflow-hidden items-center justify-center p-4 selection:bg-emerald-600 selection:text-white"
      >
        <LoginModal isStandalone={true} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      className="flex h-screen w-screen bg-[var(--surface-base)] text-[var(--text-primary)] font-sans overflow-hidden selection:bg-emerald-600 selection:text-white"
    >
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Chat Workspace */}
      <main className="flex-1 flex overflow-hidden min-w-0 bg-[var(--surface-base)]">
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

      {/* Persistent Non-Blocking Toasts */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
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
