// Desktop Notification Service for Windows Bottom-Right Popups (WhatsApp Web / Slack style)
// Uses Service Worker registration where available to ensure delivery even when Chrome is minimized

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

let swRegistration: ServiceWorkerRegistration | null = null;
let isInitializing = false;

/**
 * Initializes and registers the background Service Worker for reliable minimized notifications.
 */
export async function initDesktopNotificationService(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (swRegistration) return swRegistration;
  if (isInitializing) {
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }

  isInitializing = true;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    try {
      await reg.update();
    } catch {}
    const readyReg = await navigator.serviceWorker.ready;
    swRegistration = readyReg;
    return readyReg;
  } catch (err) {
    console.warn('[Notifications] Service worker registration notice:', err);
    return null;
  } finally {
    isInitializing = false;
  }
}

// Automatically attempt service worker initialization in the background
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  initDesktopNotificationService().catch(() => {});
}

export function getDesktopNotificationPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await initDesktopNotificationService();
      await sendTestDesktopNotification(0);
    }
    return result as NotificationPermissionStatus;
  } catch (err) {
    console.warn('[Notifications] Error requesting permission:', err);
    return Notification.permission as NotificationPermissionStatus;
  }
}

export interface TestNotificationOptions {
  delayMs?: number;
  conversationId?: string;
  recipientId?: string | number;
  teamName?: string;
}

export async function sendTestDesktopNotification(param?: number | TestNotificationOptions) {
  if (getDesktopNotificationPermission() !== 'granted') return;

  const opts: TestNotificationOptions = typeof param === 'number'
    ? { delayMs: param }
    : (param || {});

  const delayMs = opts.delayMs || 0;

  const trigger = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const iconUrl = `${origin}/icon-192.png`;
    const title = 'C4S-Connector • Notifications Active';
    const targetConv = opts.conversationId || 'c-team-ai';
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
    const apiUrl = typeof window !== 'undefined' ? (localStorage.getItem('chat_server_base_url') || window.location.origin) : '';

    const notifOptions: any = {
      body: 'Windows desktop popups are working! Try typing a reply in the box below.',
      icon: iconUrl,
      badge: iconUrl,
      tag: `test-${Date.now()}`,
      renotify: true,
      data: {
        url: origin,
        conversationId: targetConv,
        recipientId: opts.recipientId,
        teamName: opts.teamName,
        token: token,
        apiUrl: apiUrl
      },
      actions: [
        {
          action: 'reply',
          type: 'text',
          title: 'Reply',
          placeholder: 'Type a reply...'
        },
        {
          action: 'mark_read',
          title: 'Mark as read'
        }
      ]
    };

    // 1. Try Service Worker first (preferred for Chrome minimized/background state)
    let dispatched = false;
    try {
      let reg = swRegistration;
      if (!reg && 'serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.ready.catch(() => null);
      }
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notifOptions);
        dispatched = true;
      }
    } catch (e) {
      console.warn('[Notifications] SW test notification failed, falling back:', e);
    }

    // 2. Fallback to window Notification API
    if (!dispatched) {
      try {
        const notif = new Notification(title, notifOptions);
        notif.onclick = () => {
          try {
            window.focus();
          } catch {}
          notif.close();
        };
      } catch (e) {
        console.warn('[Notifications] Failed to send test notification:', e);
      }
    }
  };

  if (delayMs > 0) {
    setTimeout(trigger, delayMs);
  } else {
    await trigger();
  }
}

export interface IncomingMessageNotificationOptions {
  senderName: string;
  senderId?: string;
  recipientId?: string | number;
  channelName?: string;
  teamName?: string;
  content?: string;
  conversationId: string;
  isDm: boolean;
  hasAttachments?: boolean;
  attachmentName?: string;
  privacyMode?: boolean;
  canReply?: boolean;
  onClick?: () => void;
}

export async function showIncomingMessageNotification(opts: IncomingMessageNotificationOptions) {
  if (getDesktopNotificationPermission() !== 'granted') return;

  try {
    let preview = opts.privacyMode ? 'New message received' : (opts.content?.trim() || '');
    if (!opts.privacyMode) {
      if (!preview && opts.hasAttachments) {
        preview = opts.attachmentName ? `📎 Sent attachment: ${opts.attachmentName}` : '📎 Sent an attachment';
      } else if (preview.length > 90) {
        preview = preview.slice(0, 90) + '...';
      }
    }

    const title = opts.isDm
      ? `C4S-Connector • ${opts.senderName}`
      : `C4S-Connector • ${opts.senderName} (${opts.channelName ? `#${opts.channelName}` : opts.conversationId.replace('c-', '#')})`;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const iconUrl = `${origin}/icon-192.png`;
    const badgeUrl = `${origin}/icon-192.png`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
    const apiUrl = typeof window !== 'undefined' ? (localStorage.getItem('chat_server_base_url') || window.location.origin) : '';
    const notifActions: any[] = [];
    if (opts.canReply !== false) {
      notifActions.push({
        action: 'reply',
        type: 'text',
        title: 'Reply',
        placeholder: 'Type a message...'
      });
    }
    notifActions.push({
      action: 'mark_read',
      title: 'Mark as read'
    });

    const notifOptions: any = {
      body: preview || 'New message received',
      icon: iconUrl,
      badge: badgeUrl,
      // Unique tag per message ensures Windows always creates a distinct toast banner instead of collapsing
      tag: `${opts.conversationId}-${Date.now()}`,
      renotify: true,
      data: {
        url: `${origin}/?conv=${encodeURIComponent(opts.conversationId)}`,
        conversationId: opts.conversationId,
        recipientId: opts.recipientId,
        teamName: opts.teamName,
        canReply: opts.canReply !== false,
        token: token,
        apiUrl: apiUrl
      },
      actions: notifActions
    };

    // 1. Try Service Worker first (guarantees delivery on Windows when Chrome is minimized)
    let delivered = false;
    try {
      let reg = swRegistration;
      if (!reg && 'serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.ready.catch(() => null);
      }
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notifOptions);
        delivered = true;
      }
    } catch (swErr) {
      console.warn('[Notifications] SW showNotification error, falling back:', swErr);
    }

    // 2. Fallback to Window Notification API
    if (!delivered) {
      const notif = new Notification(title, notifOptions);
      notif.onclick = () => {
        try {
          window.focus();
        } catch {
          // ignore
        }
        if (opts.onClick) {
          opts.onClick();
        }
        notif.close();
      };
    }
  } catch (err) {
    console.warn('[Notifications] Failed to trigger Windows desktop notification:', err);
  }
}

export async function showMissedMessagesNotification(totalCount: number, details: string, onClick?: () => void) {
  if (getDesktopNotificationPermission() !== 'granted') return;

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const iconUrl = `${origin}/icon-192.png`;
    const title = `C4S-Connector • Missed Messages (${totalCount})`;
    const notifOptions: any = {
      body: details || `You have ${totalCount} unread message${totalCount === 1 ? '' : 's'}. Click to catch up.`,
      icon: iconUrl,
      badge: iconUrl,
      tag: `missed-${Date.now()}`,
      renotify: true,
      data: {
        url: origin
      }
    };

    let delivered = false;
    try {
      let reg = swRegistration;
      if (!reg && 'serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.ready.catch(() => null);
      }
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, notifOptions);
        delivered = true;
      }
    } catch (e) {
      // fallback
    }

    if (!delivered) {
      const notif = new Notification(title, notifOptions);
      notif.onclick = () => {
        try {
          window.focus();
        } catch {
          // ignore
        }
        if (onClick) onClick();
        notif.close();
      };
    }
  } catch (err) {
    console.warn('[Notifications] Failed to trigger missed messages notification:', err);
  }
}

export async function closeNotificationsForConversation(conversationId: string) {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'CLOSE_NOTIFICATIONS_FOR_CONVERSATION',
          conversationId
        });
      }
    }
  } catch (err) {
    console.warn('[Notifications] Failed to close notifications for conversation:', err);
  }
}
