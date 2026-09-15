// Service Worker v3.1 for C4S-Connector
// Handles background notifications, direct inline replies, and focus navigation

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  } else if (event.data && event.data.type === 'CLOSE_NOTIFICATIONS_FOR_CONVERSATION') {
    const { conversationId } = event.data;
    self.registration.getNotifications().then((notifications) => {
      notifications.forEach((n) => {
        if (n.data && (n.data.conversationId === conversationId || (n.tag && n.tag.startsWith(conversationId)))) {
          n.close();
        }
      });
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';
  const targetConvId = notifData.conversationId;
  const token = notifData.token;
  const apiUrl = notifData.apiUrl;
  const recipientId = notifData.recipientId;
  const teamName = notifData.teamName;
  const action = event.action;
  const replyText = event.reply || (event.notification && event.notification.reply);

  event.waitUntil(
    (async () => {
      // 1. Handle Inline Text Reply Action
      if (action === 'reply') {
        if (replyText && typeof replyText === 'string' && replyText.trim()) {
          const trimmed = replyText.trim();
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          let handledByClient = false;
          const replyId = `reply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          // Dispatch to a SINGLE active client window (prefer focused, else first available)
          if (clientList && clientList.length > 0) {
            const targetClient = clientList.find(c => c.focused) || clientList[0];
            if (targetClient) {
              targetClient.postMessage({
                type: 'INLINE_REPLY',
                replyId,
                conversationId: targetConvId,
                content: trimmed
              });
              handledByClient = true;
            }
          }

          // Direct API fallback: ONLY if no open client tab exists to process the message AND notification explicitly allows replies
          const canReply = notifData.canReply !== false && targetConvId !== 'c-announcements';
          if (!handledByClient && token && canReply) {
            try {
              const base = (apiUrl || self.location.origin).replace(/\/$/, '');
              const endpoint = `${base}/api/messages`;
              let msgFormat = 'plain';
              if (targetConvId === 'c-announcements') {
                msgFormat = 'channel:announcements';
              } else if (targetConvId === 'c-updates') {
                msgFormat = 'channel:updates';
              }

              const payload = {
                content: trimmed,
                format: msgFormat
              };
              if (recipientId) {
                payload.recipient_id = Number(recipientId);
              } else if (teamName) {
                payload.team = teamName;
              }

              await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
              });
            } catch (apiErr) {
              console.warn('[SW] Direct reply fallback notice:', apiErr);
            }
          }

          // Note: Redundant 'Reply Sent' notification popup has been intentionally removed per user request
          return;
        } else {
          // Action button clicked without inline text: bring window forward
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of clientList) {
            if ('focus' in client) {
              await client.focus();
              client.postMessage({
                type: 'OPEN_QUICK_REPLY',
                conversationId: targetConvId
              });
              return;
            }
          }
          if (self.clients.openWindow) {
            await self.clients.openWindow(targetUrl);
          }
          return;
        }
      }

      // 2. Handle Mark as Read Action
      if (action === 'mark_read') {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type: 'MARK_READ_CONVERSATION',
            conversationId: targetConvId
          });
        }
        return;
      }

      // 3. Notification Body Click: Focus Window and Navigate
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      let focused = false;
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            await client.focus();
            if (targetConvId) {
              client.postMessage({
                type: 'NAVIGATE_CONVERSATION',
                conversationId: targetConvId
              });
            }
            focused = true;
            break;
          } catch (fErr) {
            console.warn('[SW] client.focus error:', fErr);
          }
        }
      }

      if (!focused && self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
