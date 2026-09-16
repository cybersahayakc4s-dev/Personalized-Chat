import { User, Channel, DirectMessage, Message, AuditLog, WorkspaceSettings, TeamId } from '../types';

export const TEAMS_META: Record<TeamId, { name: string; label: string; color: string; bg: string; border: string; description: string }> = {
  team_ai: {
    name: 'AI Engineering',
    label: 'team_ai',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    border: 'border-indigo-200 dark:border-indigo-500/30',
    description: 'Foundation models, fine-tuning, inference infra & evaluation'
  },
  team_legal: {
    name: 'Legal & Compliance',
    label: 'team_legal',
    color: 'text-amber-800 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    description: 'Regulatory adherence, data governance, intellectual property & contracts'
  },
  hr_admin: {
    name: 'People & HR Ops',
    label: 'hr_admin',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    description: 'Human resources, benefits & onboarding (Team tag - not admin role)'
  },
  seo: {
    name: 'SEO & Growth',
    label: 'seo',
    color: 'text-cyan-800 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    border: 'border-cyan-200 dark:border-cyan-500/30',
    description: 'Technical SEO, indexation monitoring, performance & search algorithms'
  },
  coordination: {
    name: 'Operations & Coordination',
    label: 'coordination',
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    description: 'Program management, operational cadences, cross-team release velocity'
  }
};

// Strictly Main Admin profile only
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_1',
    name: 'Main Admin',
    handle: 'admin',
    email: 'admin@company.internal',
    role: 'main_admin',
    team: 'coordination',
    status: 'online',
    title: 'Platform Lead & Main Admin',
    joinedAt: '2026-09-01T08:00:00Z',
    isActive: true
  }
];

export const INITIAL_CHANNELS: Channel[] = [
  {
    id: 'c-announcements',
    name: 'announcements',
    description: 'High-priority organizational directives and bulletins. Postable exclusively by Main-Admin (CEO).',
    type: 'announcement',
    topic: 'Official company bulletins • Read-only for general staff • CEO / Main-Admin only',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  },
  {
    id: 'c-updates',
    name: 'updates',
    description: 'Cross-department progress reports, sprint releases, and operational milestones.',
    type: 'public',
    topic: 'Weekly progress reports & milestones • Postable by Team Leads & CEO',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  },
  {
    id: 'c-team-legal',
    name: 'Legal',
    description: 'Contract reviews, compliance updates, IP filings, and data governance discussions.',
    type: 'team',
    team: 'team_legal',
    topic: 'Confidential: Internal counsel and regulatory oversight',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  },
  {
    id: 'c-team-ai',
    name: 'AI Team',
    description: 'Model evaluations, fine-tuning checkpoints, token throughput, and ML infrastructure.',
    type: 'team',
    team: 'team_ai',
    topic: 'Quantization benchmarks and prompt engineering experiments',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  },
  {
    id: 'c-seo',
    name: 'SEO & Growth',
    description: 'Keyword indexation, technical crawls, search console anomaly alerts, and growth experiments.',
    type: 'team',
    team: 'seo',
    topic: 'Tracking SERP rankings and programmatic page speeds',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  },
  {
    id: 'c-coordination',
    name: 'Coordination',
    description: 'Cross-functional dependencies, sprint milestones, incident desk, and deployment calendars.',
    type: 'team',
    team: 'coordination',
    topic: 'Operational alignment across engineering, legal, SEO, and HR',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  },
  {
    id: 'c-hr-admin',
    name: 'HR & Admin',
    description: 'Internal people operations, talent pipeline, compensation frameworks, and perks.',
    type: 'team',
    team: 'hr_admin',
    topic: 'People operations & organization logistics',
    createdAt: '2026-09-01T00:00:00Z',
    createdBy: 'usr_1'
  }
];

export const INITIAL_DMS: DirectMessage[] = [];

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-09-09T08:00:00Z',
    actorId: 'usr_1',
    action: 'SYSTEM_BOOTSTRAP',
    details: 'Initialized Cyber Sahayak Chat server.',
    ipAddress: '127.0.0.1'
  }
];

export const INITIAL_SETTINGS: WorkspaceSettings = {
  name: 'Cyber Sahayak',
  domain: 'cybersahayak.local',
  retentionDays: 90,
  allowFileUploads: true,
  maxUploadSizeBytes: 500 * 1024 * 1024, // 500MB
  maintenanceNotice: '',
  soundEnabled: true,
  serverUrl: '',
  allowCustomChannels: false
};
