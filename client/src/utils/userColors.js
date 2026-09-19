/**
 * Soft, faded color palettes for user avatars.
 * Muted, low-saturation tones to avoid eye strain.
 * Colors vary per user so avatars remain distinguishable.
 */

export const USER_COLOR_PALETTES = [
  { name: 'rose',    bg: '#3d1a1a', text: '#f2a8a8', border: '#5c2828' },   // faded red/rose
  { name: 'amber',   bg: '#382a10', text: '#f0c080', border: '#5a4418' },   // faded amber
  { name: 'teal',    bg: '#0f2d2a', text: '#80cfc8', border: '#1a4a44' },   // faded teal
  { name: 'indigo',  bg: '#1a1e3d', text: '#9aa8e8', border: '#282e5c' },   // faded indigo
  { name: 'sage',    bg: '#1a2a1c', text: '#90c898', border: '#284030' },   // faded sage green
  { name: 'plum',    bg: '#2a1a32', text: '#c094d0', border: '#40284a' },   // faded plum
  { name: 'slate',   bg: '#1a2030', text: '#8aa0c0', border: '#283050' },   // faded slate blue
  { name: 'sienna',  bg: '#2e1e14', text: '#d4a080', border: '#4a2e1e' },   // faded sienna
];

/**
 * Deterministically pick a palette based on userId or name.
 */
export function getUserColorProfile(userId, userName = '') {
  const key = String(userId || userName || '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return USER_COLOR_PALETTES[hash % USER_COLOR_PALETTES.length];
}

/**
 * Return the text color (CSS value) for a user's name label.
 */
export function getUserNameColor(userId, userName = '') {
  return getUserColorProfile(userId, userName).text;
}
