import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { TeamId, ChannelType } from '../../types';
import { X, Hash, Plus, ShieldAlert } from 'lucide-react';

export const NewChannelModal: React.FC = () => {
  const {
    newChannelModalOpen,
    setNewChannelModalOpen,
    currentUser,
    createChannel
  } = useChat();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChannelType>('team');
  const [team, setTeam] = useState<TeamId>('team_ai');
  const [topic, setTopic] = useState('');

  if (!newChannelModalOpen) return null;

  if (currentUser.role !== 'main_admin') {
    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) setNewChannelModalOpen(false);
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#070A0F]/75 p-4 cursor-pointer animate-in fade-in duration-150"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-6 rounded-[8px] bg-[#0B111E] border border-[#1E293B] text-center max-w-sm cursor-default shadow-2xl"
        >
          <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <h3 className="font-semibold text-[#F1F5F9] text-[15px]">Permission Required</h3>
          <p className="text-xs text-[#94A3B8] mt-1">
            Only Main-Admin (`alex.vance`) can create organizational and team channels.
          </p>
          <button
            type="button"
            onClick={() => setNewChannelModalOpen(false)}
            className="mt-4 h-8 px-4 rounded-[4px] bg-[#1E293B] hover:bg-[#334155] text-xs text-[#CBD5E1] transition-colors cursor-pointer"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070A0F]/75 backdrop-blur-[4px] p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0B111E] border border-[#1E293B] rounded-[8px] shadow-[0_20px_48px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col cursor-default"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1E293B] bg-[#090D16] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[4px] bg-[#2563EB]/15 text-[#60A5FA]">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[14px] text-[#F1F5F9]">
                Create New Channel
              </h3>
              <p className="text-[11px] text-[#94A3B8] font-mono">
                Admin Channel Provisioning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewChannelModalOpen(false)}
            className="p-2 rounded-[4px] flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] active:bg-[#283548] transition-colors cursor-pointer"
            title="Close modal (Tap outside to close)"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-[#CBD5E1] mb-1 font-mono text-[11px]">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-[#64748B] font-mono">#</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. security-audits"
                required
                autoFocus
                className="w-full h-9 pl-7 pr-3 rounded-[4px] bg-[#090D16] border border-[#1E293B] text-[#F1F5F9] placeholder-[#475569] focus:outline-hidden focus:border-[#2563EB] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#CBD5E1] mb-1 font-mono text-[11px]">
              Channel Type
            </label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ChannelType)}
              className="w-full h-9 px-2.5 rounded-[4px] bg-[#090D16] border border-[#1E293B] text-[#F1F5F9] focus:outline-hidden focus:border-[#2563EB]"
            >
              <option value="team">Team Channel (Restricted to specific team)</option>
              <option value="public">Public (Accessible to all company)</option>
              <option value="announcement">Announcement (Admin Broadcast Only)</option>
            </select>
          </div>

          {type === 'team' && (
            <div>
              <label className="block text-[#CBD5E1] mb-1 font-mono text-[11px]">
                Target Team (Strict 5 Teams)
              </label>
              <select
                value={team}
                onChange={e => setTeam(e.target.value as TeamId)}
                className="w-full h-9 px-2.5 rounded-[4px] bg-[#090D16] border border-[#1E293B] text-[#F1F5F9] focus:outline-hidden focus:border-[#2563EB] font-mono"
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
            <label className="block text-[#CBD5E1] mb-1 font-mono text-[11px]">
              Topic / Purpose
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="What will be discussed here?"
              className="w-full h-9 px-3 rounded-[4px] bg-[#090D16] border border-[#1E293B] text-[#F1F5F9] placeholder-[#475569] focus:outline-hidden focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-[#CBD5E1] mb-1 font-mono text-[11px]">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detailed description of channel scope..."
              rows={2}
              className="w-full p-2.5 rounded-[4px] bg-[#090D16] border border-[#1E293B] text-[#F1F5F9] placeholder-[#475569] focus:outline-hidden focus:border-[#2563EB] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={() => setNewChannelModalOpen(false)}
              className="h-8 px-4 rounded-[4px] bg-[#1E293B] hover:bg-[#334155] text-xs font-medium text-[#CBD5E1] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-4 rounded-[4px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
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
