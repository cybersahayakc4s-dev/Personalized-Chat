/**
 * Safely parses a server datetime string.
 * Python/SQLite datetimes stored as UTC often lack a timezone offset (e.g. "2026-09-09T09:49:00").
 * Without an explicit timezone indicator, JavaScript's Date constructor treats ISO strings
 * as local time instead of UTC, causing hours to be off by the local timezone offset.
 *
 * This function appends 'Z' when missing so the browser correctly treats it as UTC
 * and converts it to the user's local timezone.
 */
export function parseServerDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    // If it has no timezone suffix ('Z', '+HH:MM', or '-HH:MM'), append 'Z'
    if (!trimmed.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(trimmed + 'Z');
    }
    return new Date(trimmed);
  }

  return new Date(dateStr);
}

/**
 * Format timestamp for message bubbles in chat window.
 * Example output: "03:19 PM"
 */
export function formatMessageTime(dateStr) {
  const date = parseServerDate(dateStr);
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format timestamp for sidebar conversations (DMs and Teams).
 * Today: "03:19 PM"
 * Yesterday: "Yesterday"
 * Older: "Sep 9"
 */
export function formatSidebarTime(dateStr) {
  const date = parseServerDate(dateStr);
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Format a date divider pill label.
 * Today: "TODAY, OCTOBER 24"
 * Yesterday: "YESTERDAY"
 * Otherwise: "MONDAY, SEPTEMBER 9"
 */
export function formatDateDivider(dateStr) {
  const date = parseServerDate(dateStr);
  if (!date || isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Today, ${date.toLocaleDateString([], { month: 'long', day: 'numeric' }).toUpperCase()}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'YESTERDAY';
  }

  const monthDay = date.toLocaleDateString([], { month: 'long', day: 'numeric' });
  const weekday = date.toLocaleDateString([], { weekday: 'long' });
  return `${weekday.toUpperCase()}, ${monthDay.toUpperCase()}`;
}

/**
 * Key to group messages by their calendar day.
 */
export function getDayKey(dateStr) {
  const date = parseServerDate(dateStr);
  if (!date || isNaN(date.getTime())) return 'unknown';
  return date.toDateString();
}
