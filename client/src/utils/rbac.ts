import { Channel, User } from '../types';

export interface UserAuthContext {
  role?: string;
  team?: string;
  is_main_admin?: boolean;
}

export interface AccessCheckResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Checks whether a given user is authorized to view and interact with a channel.
 * Universal Rules:
 * 1. Main-Admin (CEO) has universal authorization across all channels and departments.
 * 2. Non-team channels (announcements, updates, public channels) are accessible by all authenticated users.
 * 3. Team/department channels (channel.type === 'team' or channel.team) are strictly accessible
 *    only to members assigned to that specific department (or Main-Admin).
 *
 * This check is completely dynamic and does not rely on hardcoded team or channel names.
 */
export function isChannelAuthorized(
  channel: Channel | undefined | null,
  user: UserAuthContext | null | undefined
): AccessCheckResult {
  if (!channel) {
    return { authorized: true };
  }

  // 1. Unrestricted for Main Admin (CEO)
  if (user?.role === 'main_admin' || user?.is_main_admin) {
    return { authorized: true };
  }

  // 2. Public, announcement, or non-team channels
  if (channel.type !== 'team' && !channel.team) {
    return { authorized: true };
  }

  // 3. Department / Team channel
  const targetTeam = channel.team;
  if (!targetTeam) {
    return { authorized: true };
  }

  // Check user team assignment dynamically
  if (user?.team && user.team === targetTeam) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: `Access to #${channel.name} is restricted to members of the ${targetTeam} department and Main-Admin.`
  };
}

/**
 * Dynamically resolves the user's home department channel from the active channel list.
 * If user has an assigned department, it finds the matching channel where channel.team === user.team.
 * If not found or if user has no department, falls back to the first authorized channel.
 */
export function getUserDepartmentChannel(
  channels: Channel[],
  user: UserAuthContext | null | undefined
): string {
  if (!channels || channels.length === 0) {
    return 'c-announcements';
  }

  // If user has a department, locate that department's channel
  if (user?.team) {
    const matchingTeamChannel = channels.find(
      c => (c.type === 'team' || Boolean(c.team)) && c.team === user.team && !c.isArchived
    );
    if (matchingTeamChannel) {
      return matchingTeamChannel.id;
    }
  }

  // If Main-Admin or no department match, prefer announcements or first authorized channel
  const announcements = channels.find(c => c.id === 'c-announcements');
  if (announcements) return announcements.id;

  const firstAuthorized = channels.find(c => isChannelAuthorized(c, user).authorized && !c.isArchived);
  return firstAuthorized ? firstAuthorized.id : channels[0].id;
}

/**
 * Validates the currently active conversation against the user's credentials.
 * If the current conversation is a channel that the user is not authorized to access,
 * dynamically redirects to the user's authorized home department channel.
 */
export function getAuthorizedConversationOnSessionChange(
  channels: Channel[],
  user: UserAuthContext | null | undefined,
  currentConversationId: string
): string {
  // If it's a DM, allow maintaining DM selection
  if (currentConversationId.startsWith('dm-')) {
    return currentConversationId;
  }

  const targetChannel = channels.find(c => c.id === currentConversationId);
  if (!targetChannel) {
    // If channel doesn't exist in registry, redirect to user's home department
    return getUserDepartmentChannel(channels, user);
  }

  const check = isChannelAuthorized(targetChannel, user);
  if (!check.authorized) {
    return getUserDepartmentChannel(channels, user);
  }

  return currentConversationId;
}

/**
 * Dynamically resolves the backend team enum/name from a channel ID without string pattern matching.
 */
export function getTeamNameFromConversationId(
  channels: Channel[],
  conversationId: string
): string | null {
  const channel = channels.find(c => c.id === conversationId);
  if (channel && channel.team) {
    return channel.team;
  }
  return null;
}
