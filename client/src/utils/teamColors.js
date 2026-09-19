/**
 * Team Identity per NEW-DESIGN.md:
 * Restrained grayscale-first system with single Navy functional accent.
 * No hardcoded hex codes.
 */

export const TEAM_COLORS = {
  team_legal: 'var(--text-secondary)',
  team_ai: 'var(--text-secondary)',
  hr_admin: 'var(--text-secondary)',
  seo: 'var(--text-secondary)',
  coordination: 'var(--text-secondary)',
};

export function getTeamColor(_teamKey) {
  return 'var(--text-secondary)';
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
