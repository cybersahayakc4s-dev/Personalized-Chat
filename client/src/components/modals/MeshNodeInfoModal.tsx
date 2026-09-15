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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px] p-4 animate-in fade-in duration-150 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white border border-slate-200 rounded-[10px] shadow-[0_25px_60px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col text-slate-800 animate-in zoom-in-95 duration-150 cursor-default"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#0A1938] to-[#122C5C] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[15px] text-white">Mesh Node #01</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
                  SELF-HOSTED
                </span>
              </div>
              <p className="text-[11px] text-blue-200 font-mono mt-0.5">
                node-01.mesh.personalize.internal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[6px] flex items-center justify-center text-blue-200 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
            title="Close modal (Tap outside to close)"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-[13px] leading-relaxed max-h-[75vh] overflow-y-auto">
          {/* Question 1: What is Mesh Node #01? */}
          <div className="p-3.5 rounded-[8px] bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1 text-[14px]">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h4>What is Mesh Node #01?</h4>
            </div>
            <p className="text-slate-600 text-[12.5px]">
              A <strong>Mesh Node</strong> represents an internal cluster server instance routing messages, synchronization states, and team channels across Personalize Inc. <strong>Node #01</strong> is your organization's primary sovereign node that processes real-time events, team permissions, and channel broadcasts.
            </p>
          </div>

          {/* Question 2: What is Self-Hosted? */}
          <div className="p-3.5 rounded-[8px] bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1 text-[14px]">
              <Database className="w-4 h-4 text-emerald-600" />
              <h4>What does Self-Hosted mean?</h4>
            </div>
            <p className="text-slate-600 text-[12.5px]">
              Unlike commercial SaaS messengers (like Slack, Teams, or Discord) that store corporate communications on third-party cloud infrastructure, this platform is <strong>100% self-hosted on Personalize Inc.’s private network</strong>. Your organization maintains total data sovereignty: zero external cloud dependencies, zero advertising trackers, and no third-party inspection.
            </p>
          </div>

          {/* Core Security & Privacy Guarantees */}
          <div>
            <h5 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              Node Security & Governance Guarantees
            </h5>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-2.5 p-2.5 rounded-[6px] bg-blue-50/50 border border-blue-100 text-xs">
                <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Zero-Backdoor Direct Messages:</span>
                  <span className="text-slate-600 block mt-0.5">
                    1:1 direct messages are strictly isolated to the two conversational participants. Even the Main-Admin cannot read or inspect private colleague DMs.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-[6px] bg-emerald-50/50 border border-emerald-100 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Five Strict Team Boundaries:</span>
                  <span className="text-slate-600 block mt-0.5">
                    Enforces RBAC access across AI Engineering, Legal & Compliance, Product Design, Finance, and Security without cross-leakage.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Node Health: 100% Operational • Latency &lt; 2ms
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-[4px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
