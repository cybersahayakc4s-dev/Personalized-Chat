import React from 'react';
import { Server, Shield, Lock, Cpu, Database, CheckCircle2, X } from 'lucide-react';

interface MeshNodeInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MeshNodeInfoModal: React.FC<MeshNodeInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[var(--text-primary)] animate-in zoom-in-95 duration-150 cursor-default"
      >
        {/* Header */}
        <div className="p-4 border-b border-subtle bg-surface-hover flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center text-accent">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-primary">Mesh Node #01</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-secondary border border-subtle font-mono font-medium">
                  SELF-HOSTED
                </span>
              </div>
              <p className="text-xs text-secondary font-mono mt-0.5">
                node-01.mesh.personalize.internal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg flex items-center justify-center text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs leading-relaxed max-h-[75vh] overflow-y-auto">
          {/* Question 1: What is Mesh Node #01? */}
          <div className="p-3.5 rounded-lg bg-canvas border border-subtle">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1 text-sm">
              <Cpu className="w-4 h-4 text-accent" />
              <h4>What is Mesh Node #01?</h4>
            </div>
            <p className="text-[var(--text-secondary)] text-xs">
              A <strong>Mesh Node</strong> represents an internal cluster server instance routing messages, synchronization states, and team channels across Personalize Inc. <strong>Node #01</strong> is your organization's primary sovereign node that processes real-time events, team permissions, and channel broadcasts.
            </p>
          </div>

          {/* Question 2: What is Self-Hosted? */}
          <div className="p-3.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-semibold mb-1 text-sm">
              <Database className="w-4 h-4 text-emerald-500" />
              <h4>What does Self-Hosted mean?</h4>
            </div>
            <p className="text-[var(--text-secondary)] text-xs">
              Unlike commercial SaaS messengers (like Slack, Teams, or Discord) that store corporate communications on third-party cloud infrastructure, this platform is <strong>100% self-hosted on Personalize Inc.’s private network</strong>. Your organization maintains total data sovereignty: zero external cloud dependencies, zero advertising trackers, and no third-party inspection.
            </p>
          </div>

          {/* Core Security & Privacy Guarantees */}
          <div>
            <h5 className="font-semibold text-[var(--text-primary)] text-xs uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
              Node Security & Governance Guarantees
            </h5>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-xs">
                <Lock className="w-4 h-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Zero-Backdoor Direct Messages:</span>
                  <span className="text-[var(--text-secondary)] block mt-0.5">
                    1:1 direct messages are strictly isolated to the two conversational participants. Even the Main Admin cannot read or inspect private colleague DMs.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Five Strict Team Boundaries:</span>
                  <span className="text-[var(--text-secondary)] block mt-0.5">
                    Enforces RBAC access across AI Engineering, Legal & Compliance, SEO & Growth, Coordination, and HR & Admin without cross-leakage.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)] font-mono text-xs">
            Node Health: 100% Operational • Latency &lt; 2ms
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
