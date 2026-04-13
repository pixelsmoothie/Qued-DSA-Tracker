"use client";

import { motion } from "framer-motion";
import { Brain, Zap, Square } from "lucide-react";
import { AVAILABLE_MODELS, Model } from "./types";
import { PERSONA_META, InterviewerPersona } from "../../lib/prompts";

interface PersonaSelectProps {
  persona: InterviewerPersona;
  setPersona: (p: InterviewerPersona) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  mission: any;
  onBegin: (p: InterviewerPersona) => void;
  onExit: () => void;
  apiProvider?: string;
  externalModel?: string;
}

export default function PersonaSelect({
  persona,
  setPersona,
  selectedModel,
  setSelectedModel,
  mission,
  onBegin,
  onExit,
  apiProvider = "ollama",
  externalModel = ""
}: PersonaSelectProps) {
  return (
    <div className="flex flex-col h-full w-full bg-claude-bg text-claude-text overflow-hidden font-sans border border-claude-border rounded-2xl shadow-2xl">
      <header className="h-14 border-b border-claude-border bg-claude-panel/30 flex items-center justify-between px-8 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-accent">
          Interview Engine v1.0
        </span>
        <button onClick={onExit} className="p-2 hover:bg-red-500/10 text-claude-muted hover:text-red-400 rounded-lg transition-all">
          <Square size={18} />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-10 overflow-y-auto">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white tracking-tight mb-1">Configure Your Interview (BETA)</h2>
          <p className="text-[12px] text-claude-muted">Choose a company, pick a model, begin.</p>
        </div>

        {/* Persona cards */}
        <div className="flex gap-4">
          {(["amazon", "google", "senior"] as InterviewerPersona[]).map(p => {
            const m = PERSONA_META[p];
            const active = persona === p;
            return (
              <motion.button
                key={p}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setPersona(p)}
                className={`w-52 p-6 rounded-3xl border-2 flex flex-col items-center gap-3 text-center transition-all ${active ? "shadow-2xl" : "border-claude-border bg-claude-panel/40 hover:border-claude-border/80"
                  }`}
                style={active ? {
                  borderColor: m.color + "60",
                  background: m.color + "08",
                  boxShadow: `0 0 40px ${m.color}20`,
                } : {}}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: m.color + "25" }}>
                  {m.emoji}
                </div>
                <div>
                  <div className="text-sm font-black text-white">{m.label}</div>
                  <div className="text-[9px] text-claude-muted uppercase tracking-widest mt-0.5">{m.subtitle}</div>
                </div>
                <p className="text-[10px] text-claude-text/40 leading-relaxed">{m.description}</p>
                {active && (
                  <div className="w-full py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest"
                    style={{ background: m.color + "25", color: m.color }}>
                    Selected
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Model picker */}
        <div className="w-[500px] bg-claude-panel/40 border border-claude-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={14} className="text-claude-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest text-claude-muted">
              {apiProvider === "ollama" ? "AI Model (Local)" : "Neural Bridge (Cloud)"}
            </span>
          </div>

          {apiProvider === "ollama" ? (
            <div className="grid grid-cols-2 gap-2.5">
              {AVAILABLE_MODELS.map(m => {
                const active = selectedModel === m.id;
                return (
                  <button key={m.id} onClick={() => setSelectedModel(m.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${active ? "bg-claude-accent/10 border-claude-accent" : "border-claude-border bg-black/20 hover:border-claude-border/60"
                      }`}>
                    <div className={`text-[12px] font-bold mb-1 ${active ? "text-claude-accent" : "text-white/70"}`}>{m.label}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-claude-muted font-bold uppercase">{m.vram}</span>
                      {active && <Zap size={9} className="text-claude-accent" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-6 bg-claude-bg/50 border border-claude-accent/20 rounded-xl flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-claude-accent animate-pulse shadow-[0_0_10px_rgba(218,119,86,0.8)]" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                  {apiProvider.toUpperCase()} Active Bridge
                </span>
              </div>
              <div className="text-[14px] font-mono font-bold text-claude-accent/80">
                {externalModel || (apiProvider === "openai" ? "GPT-4o" : "Llama-3-70b")}
              </div>
              <p className="text-[9px] text-claude-muted uppercase tracking-widest leading-relaxed">
                Hardware-agnostic assessmet active. Direct cloud pipeline established.
              </p>
            </div>
          )}
        </div>

        {/* Begin */}
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          disabled={!mission}
          onClick={() => {
            if (!mission) return;
            onBegin(persona);
          }}
          className="px-14 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl shadow-2xl disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {mission ? "Begin Interview →" : "Loading problem…"}
        </motion.button>
      </div>
    </div>
  );
}
