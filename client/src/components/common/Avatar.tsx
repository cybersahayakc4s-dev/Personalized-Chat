import React from 'react';
import { User, UserStatus } from '../../types';
import { getUserColorProfile } from '../../utils/userColors';

interface AvatarProps {
  user: Pick<User, 'name' | 'status' | 'team'> & { id?: string; avatarUrl?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
}

const statusColors: Record<UserStatus, string> = {
  online: 'bg-emerald-500 ring-2 ring-canvas shadow-xs',
  away: 'bg-amber-500 ring-2 ring-canvas',
  busy: 'bg-rose-500 ring-2 ring-canvas',
  offline: 'bg-slate-400 dark:bg-zinc-500 ring-2 ring-canvas'
};

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  showStatus = true,
  className = ''
}) => {
  const safeName = (user?.name || '?').trim() || '?';
  const initials = safeName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const sizeClasses = {
    xs: 'w-5 h-5 text-xs',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-14 h-14 text-base'
  };

  const statusSizeClasses = {
    xs: 'w-1.5 h-1.5 -bottom-0.5 -right-0.5',
    sm: 'w-2 h-2 bottom-0 right-0',
    md: 'w-2.5 h-2.5 bottom-0 right-0',
    lg: 'w-2.5 h-2.5 bottom-0 right-0',
    xl: 'w-3 h-3 bottom-0.5 right-0.5'
  };

  const palette = getUserColorProfile(user?.id, user?.name);

  return (
    <div className={`relative inline-flex flex-shrink-0 select-none ${className}`}>
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={safeName}
          className={`${sizeClasses[size]} rounded-full object-cover border border-subtle shadow-xs`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full font-medium flex items-center justify-center tracking-wider shadow-xs`}
          style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}
        >
          {initials}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute rounded-full ${statusSizeClasses[size]} ${
            statusColors[user.status || 'offline']
          }`}
          title={`Status: ${user.status}`}
        />
      )}
    </div>
  );
};
