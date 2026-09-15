/**
 * Curated palette of distinct, vibrant user colors for group chats and avatars.
 * Deterministic hash maps user ID or user name to a rich color identity
 * so every user has an easily identifiable visual identity in team chats.
 */

export const USER_COLOR_PALETTES = [
  {
    name: 'emerald',
    bg: 'bg-emerald-950/80',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    nameColor: '#34D399',
    badge: 'bg-emerald-500/20 text-emerald-300'
  },
  {
    name: 'violet',
    bg: 'bg-violet-950/80',
    text: 'text-violet-300',
    border: 'border-violet-500/40',
    nameColor: '#A78BFA',
    badge: 'bg-violet-500/20 text-violet-300'
  },
  {
    name: 'cyan',
    bg: 'bg-cyan-950/80',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    nameColor: '#22D3EE',
    badge: 'bg-cyan-500/20 text-cyan-300'
  },
  {
    name: 'amber',
    bg: 'bg-amber-950/80',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    nameColor: '#FBBF24',
    badge: 'bg-amber-500/20 text-amber-300'
  },
  {
    name: 'rose',
    bg: 'bg-rose-950/80',
    text: 'text-rose-300',
    border: 'border-rose-500/40',
    nameColor: '#FB7185',
    badge: 'bg-rose-500/20 text-rose-300'
  },
  {
    name: 'blue',
    bg: 'bg-blue-950/80',
    text: 'text-blue-300',
    border: 'border-blue-500/40',
    nameColor: '#60A5FA',
    badge: 'bg-blue-500/20 text-blue-300'
  },
  {
    name: 'fuchsia',
    bg: 'bg-fuchsia-950/80',
    text: 'text-fuchsia-300',
    border: 'border-fuchsia-500/40',
    nameColor: '#E879F9',
    badge: 'bg-fuchsia-500/20 text-fuchsia-300'
  },
  {
    name: 'lime',
    bg: 'bg-lime-950/80',
    text: 'text-lime-300',
    border: 'border-lime-500/40',
    nameColor: '#A3E635',
    badge: 'bg-lime-500/20 text-lime-300'
  },
  {
    name: 'orange',
    bg: 'bg-orange-950/80',
    text: 'text-orange-300',
    border: 'border-orange-500/40',
    nameColor: '#FB923C',
    badge: 'bg-orange-500/20 text-orange-300'
  },
  {
    name: 'teal',
    bg: 'bg-teal-950/80',
    text: 'text-teal-300',
    border: 'border-teal-500/40',
    nameColor: '#2DD4BF',
    badge: 'bg-teal-500/20 text-teal-300'
  },
  {
    name: 'indigo',
    bg: 'bg-indigo-950/80',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
    nameColor: '#818CF8',
    badge: 'bg-indigo-500/20 text-indigo-300'
  },
  {
    name: 'sky',
    bg: 'bg-sky-950/80',
    text: 'text-sky-300',
    border: 'border-sky-500/40',
    nameColor: '#38BDF8',
    badge: 'bg-sky-500/20 text-sky-300'
  }
];

export function getUserColorProfile(userId, userName = '') {
  let seed = 0;
  if (typeof userId === 'number') {
    seed = Math.abs(userId);
  } else if (typeof userId === 'string' && userId.replace('usr_', '').match(/^\d+$/)) {
    seed = parseInt(userId.replace('usr_', ''), 10);
  } else {
    const key = String(userName || userId || 'user');
    for (let i = 0; i < key.length; i++) {
      seed = (seed * 31 + key.charCodeAt(i)) & 0xffffffff;
    }
    seed = Math.abs(seed);
  }

  const index = seed % USER_COLOR_PALETTES.length;
  return USER_COLOR_PALETTES[index];
}

export function getUserColor(userId, userName = '') {
  return getUserColorProfile(userId, userName).nameColor;
}
