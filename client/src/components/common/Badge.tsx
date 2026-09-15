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
    color: 'text-slate-400',
    bg: 'bg-slate-800',
    border: 'border-slate-700'
  };

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 font-mono',
    md: 'text-xs px-2 py-0.5 font-mono',
    lg: 'text-xs px-2.5 py-1 font-mono font-medium'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${meta.bg} ${meta.border} ${meta.color} ${sizeClasses[size]} tracking-tight transition-colors ${className}`}
      title={meta.name}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
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
        className={`inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-mono font-semibold ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
        } ${className}`}
        title="Main-Admin: Platform governance & security authority"
      >
        <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
        main_admin
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-mono font-semibold ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
      } ${className}`}
    >
      <Users className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
      member
    </span>
  );
};
