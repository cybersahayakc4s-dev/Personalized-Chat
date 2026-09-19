import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { TeamId, ChannelType } from '../../types';
import { X, Hash, Plus, ShieldAlert } from 'lucide-react';

export const NewChannelModal: React.FC = () => {
  const {
    newChannelModalOpen,
    setNewChannelModalOpen,
    currentUser,
    users,
    createChannel
  } = useChat();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChannelType>('team');
  const [team, setTeam] = useState<TeamId>('team_ai');
  const [topic, setTopic] = useState('');

  if (!newChannelModalOpen) return null;

  if (currentUser?.role !== 'main_admin') {
    // Dynamically resolve the actual Main Admin name/handle
    const mainAdminUser = (users as any[])?.find((u: any) => u.role === 'main_admin');
    const adminLabel = mainAdminUser
      ? `${mainAdminUser.name} (@${mainAdminUser.handle})`
      : 'the Main Admin';

    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) setNewChannelModalOpen(false);
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 cursor-pointer animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center max-w-sm cursor-default shadow-2xl"
        >
          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">Permission Required</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Only the Main Admin ({adminLabel}) has permission to create organizational and department channels.
          </p>
          <button
            type="button"
            onClick={() => setNewChannelModalOpen(false)}
            className="mt-4 h-8 px-4 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createChannel({
      name: name.trim(),
      description: description.trim(),
      type,
      team: type === 'team' ? team : undefined,
      topic: topic.trim()
    });

    setNewChannelModalOpen(false);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setNewChannelModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col cursor-default"
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--brand-primary)]/15 text-[var(--brand-primary)]">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                Create New Channel
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                Admin Channel Provisioning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewChannelModalOpen(false)}
            className="p-2 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-[var(--text-secondary)] mb-1 font-mono text-xs">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[var(--text-muted)] font-mono">#</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. security-audits"
                required
                autoFocus
                className="w-full h-9 pl-7 pr-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--brand-primary)] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] mb-1 font-mono text-xs">
              Channel Type
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ChannelType)}
              className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--brand-primary)]"
            >
              <option value="team">Team Channel (Restricted to specific team)</option>
              <option value="public">Public (Accessible to all company)</option>
              <option value="announcement">Announcement (Admin Broadcast Only)</option>
            </select>
          </div>

          {type === 'team' && (
            <div>
              <label className="block text-[var(--text-secondary)] mb-1 font-mono text-xs">
                Target Team (Strict 5 Teams)
              </label>
              <select
                value={team}
                onChange={e => setTeam(e.target.value as TeamId)}
                className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--brand-primary)] font-mono"
              >
                <option value="team_ai">team_ai (AI Engineering)</option>
                <option value="team_legal">team_legal (Legal & Compliance)</option>
                <option value="hr_admin">hr_admin (People & Culture Team Tag)</option>
                <option value="seo">seo (SEO & Growth)</option>
                <option value="coordination">coordination (Program Management)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[var(--text-secondary)] mb-1 font-mono text-xs">
              Topic / Purpose
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="What will be discussed here?"
              className="w-full h-9 px-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label className="block text-[var(--text-secondary)] mb-1 font-mono text-xs">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detailed description of channel scope..."
              rows={2}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--brand-primary)] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setNewChannelModalOpen(false)}
              className="h-8 px-4 rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-4 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
