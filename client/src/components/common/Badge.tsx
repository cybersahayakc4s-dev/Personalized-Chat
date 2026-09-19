import React from 'react';
import { TeamId, UserRole } from '../../types';
import { TEAMS_META } from '../../data/initialData';
import { ShieldCheck, Users } from 'lucide-react';

interface TeamBadgeProps {
  team: TeamId;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({
  team,
  size = 'md',
  showLabel = true,
  className = ''
}) => {
  const meta = TEAMS_META[team] || {
    name: team,
    label: team,
    color: 'text-secondary',
    bg: 'bg-surface-hover',
    border: 'border-subtle'
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 font-mono',
    md: 'text-xs px-2 py-0.5 font-mono',
    lg: 'text-xs px-2.5 py-1 font-mono font-medium'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-hover text-secondary ${sizeClasses[size]} tracking-tight transition-colors ${className}`}
      title={meta.name}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent opacity-80" />
      {showLabel ? meta.label : meta.name}
    </span>
  );
};

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md';
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'md',
  className = ''
}) => {
  if (role === 'main_admin') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-hover text-primary font-mono font-semibold ${
          size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
        } ${className}`}
        title="Main-Admin: Platform governance & security authority"
      >
        <ShieldCheck className="w-3 h-3 text-accent" />
        main_admin
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-hover text-secondary font-mono font-semibold ${
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      } ${className}`}
    >
      <Users className="w-2.5 h-2.5 text-secondary" />
      {role}
    </span>
  );
};
