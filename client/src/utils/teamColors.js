/**
 * Team Identity Colors according to design-brief.md §2:
 * team_legal: #7C2D3A
 * team_ai: #0F6B65
 * hr_admin: #3B5170
 * seo: #B08900
 * coordination: #35603F
 */

export const TEAM_COLORS = {
  team_legal: '#7C2D3A',
  team_ai: '#0F6B65',
  hr_admin: '#3B5170',
  seo: '#B08900',
  coordination: '#35603F',
};

export function getTeamColor(teamKey) {
  if (!teamKey) return 'var(--accent)';
  return TEAM_COLORS[teamKey] || 'var(--accent)';
}

export const TEAM_DISPLAY_NAMES = {
  team_ai: 'AI Team',
  team_legal: 'Legal Team',
  hr_admin: 'HR Team',
  seo: 'SEO Team',
  coordination: 'Ops Team'
};

export function getCleanTeamName(teamKey, fallback = '') {
  if (!teamKey) return fallback;
  return TEAM_DISPLAY_NAMES[teamKey] || fallback || teamKey;
}
