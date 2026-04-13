"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2, Sparkles, MessageSquare,
  BarChart2, Zap, AlertTriangle,
  Download, Clock, Activity, CheckCircle2, Save,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MissionEditor from "../MissionEditor";
import Whiteboard from "./Whiteboard";
import { Message, Phase } from "./types";

interface WorkspaceProps {
  phase: Phase;
  mission: any;
  meta: any;
  messages: Message[];
  isThinking: boolean;
  currentCode: string;
  setCurrentCode: (c: string) => void;
  analysisAssistantMsgs: Message[];
  finalReviewActive: boolean;
  finalReviewTimer: number;
  downloadReview: () => void;
  goToGrading: () => void;
  submitCode: () => void;
  runCode: (code: string, input: string) => Promise<any>;
  onTestsComplete: (passed: number, total: number) => void;
  forceCodingPhase: () => void;
  saveReportToInventory: () => void;
}

export default function Workspace({
  phase,
  mission,
  meta,
  messages,
  isThinking,
  currentCode,
  setCurrentCode,
  analysisAssistantMsgs,
  finalReviewActive,
  finalReviewTimer,
  downloadReview,
  goToGrading,
  submitCode,
  runCode,
  onTestsComplete,
  forceCodingPhase,
  saveReportToInventory,
}: WorkspaceProps) {
  const [showWhiteboard, setShowWhiteboard] = React.useState(false);

  if (!mission) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-claude-muted bg-claude-bg p-4 flex flex-col">
        <AlertTriangle size={16} />
        <span className="text-[12px]">No unsolved missions in database.</span>
      </div>
    );
  }

  return (
    <section className="flex-1 bg-claude-bg p-4 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden bg-claude-panel border border-claude-border/40 rounded-3xl shadow-2xl relative">

          {/* ── GRADING panel */}
          {phase === "grading" && (
            <div className="h-full flex flex-col p-10 overflow-hidden max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-4 mb-8 shrink-0">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center border"
                  style={{ background: meta.color + "20", borderColor: meta.color + "40" }}>
                  <BarChart2 size={20} style={{ color: meta.color }} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">Technical Assessment</h1>
                  <p className="text-[10px] text-claude-muted/50 font-bold uppercase tracking-widest mt-0.5">
                    {isThinking ? "Computing Final Evaluation…" : "Senior Lead Interview Report"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={downloadReview} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-claude-panel border border-claude-border hover:bg-claude-hover text-claude-muted hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                    <Download size={13} /> Download
                  </button>
                  <button onClick={saveReportToInventory} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-claude-panel border border-claude-border hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-400 text-[10px] font-black uppercase tracking-widest transition-all">
                    <Save size={13} /> Save Inventory
                  </button>
                  <div className="px-5 py-2 rounded-xl font-black uppercase tracking-widest text-[11px] text-black transition-all"
                    style={{ background: meta.color, boxShadow: `0 0 20px ${meta.color}30` }}>
                    {meta.label} Verdict
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 bg-black/40 border border-claude-border/30 rounded-2xl p-8 overflow-y-auto custom-scrollbar">
                <div className="prose prose-invert max-w-none text-white/90 leading-relaxed selection:bg-claude-accent/30">
                  {isThinking && (messages.filter(m => m.role === "assistant").pop()?.content.length || 0) < 5 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                        <Sparkles size={32} className="text-claude-accent" />
                      </motion.div>
                      <p className="text-sm font-bold text-claude-accent/60 animate-pulse uppercase tracking-[0.2em]">System is compiling your grade…</p>
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {messages.filter(m => m.role === "assistant").pop()?.content || "Compiling assessment report…"}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYSIS panel */}
          {phase === "analysis" && (
            <div className="h-full overflow-y-auto custom-scrollbar p-10">
              <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <Code2 size={18} style={{ color: meta.color }} />
                    <h1 className="text-xl font-black text-white uppercase tracking-wider">Code Review</h1>
                  </div>

                  {finalReviewActive ? (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-claude-accent/10 border border-claude-accent/30">
                        <Clock size={12} className="text-claude-accent animate-pulse" />
                        <span className="text-[12px] font-mono font-bold text-white">{finalReviewTimer}s</span>
                      </div>
                      <button onClick={downloadReview} className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-claude-panel border border-claude-border hover:bg-claude-hover text-[10px] font-black uppercase tracking-widest transition-all">
                        <Download size={13} /> Download
                      </button>
                      <button onClick={goToGrading} className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105">
                        See Grade →
                      </button>
                    </div>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border"
                      style={{ borderColor: meta.color + "30", color: meta.color }}>
                      {meta.label} · Review Phase
                    </span>
                  )}
                </div>

                <div className="bg-black/30 border border-claude-border/20 rounded-2xl p-6 shrink-0 shadow-lg">
                  <p className="text-[10px] font-black uppercase tracking-widest text-claude-muted/50 mb-4 flex items-center gap-2">
                    <MessageSquare size={10} /> Interviewer Feedback
                  </p>
                  <div className="prose prose-invert max-w-none text-[13.5px] leading-relaxed space-y-6">
                    {analysisAssistantMsgs.length > 0 ? (
                      analysisAssistantMsgs.map((m, i) => (
                        <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      ))
                    ) : (
                      <p className="opacity-40 italic">Reviewing your submission…</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-claude-muted/40 px-1">
                    Submitted Implementation Details
                  </p>
                  <div className="bg-black/50 border border-claude-border/20 rounded-2xl p-8 font-mono text-[12px] leading-relaxed">
                    <pre className="text-claude-text/80 whitespace-pre-wrap">
                      {currentCode || "// No code captured."}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PROBLEM STATEMENT (intro / planning) */}
          {(phase === "intro" || phase === "planning") && (
            <div className="h-full overflow-y-auto px-10 py-10 custom-scrollbar">
              <div className="max-w-2xl mx-auto flex flex-col h-full">
                <div className="flex items-center gap-3 mb-5 shrink-0">
                  <div className="flex items-center gap-2 bg-claude-hover/30 p-1 rounded-xl border border-claude-border/20">
                    <button
                      onClick={() => setShowWhiteboard(false)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!showWhiteboard ? "bg-white text-black shadow-sm" : "text-claude-muted hover:text-white"
                        }`}
                    >
                      Mission Statement
                    </button>
                    <button
                      onClick={() => setShowWhiteboard(true)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${showWhiteboard ? "bg-white text-black shadow-sm" : "text-claude-muted hover:text-white"
                        }`}
                    >
                      Logic Whiteboard
                    </button>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase text-claude-muted/40 px-2 py-1 rounded border border-claude-border/20">
                      {phase === "planning" ? "🧠 Planning Phase" : "👋 Intro"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {!showWhiteboard ? (
                      <motion.div
                        key="statement"
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                        className="h-full overflow-y-auto pr-4 custom-scrollbar"
                      >
                        <div className="flex items-center gap-3 mb-5 mt-2">
                          <span className="px-3 py-1 rounded text-[10px] font-black border"
                            style={{ background: meta.color + "15", borderColor: meta.color + "30", color: meta.color }}>
                            {mission.topic}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">
                            {mission.difficulty}
                          </span>
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-5">{mission.name}</h1>
                        <div className="border-l-2 pl-6 py-2 mb-8 rounded-r-xl text-claude-text/70 italic text-[14px] leading-relaxed"
                          style={{ borderColor: meta.color + "60", background: meta.color + "05" }}>
                          {mission.description}
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-claude-muted mb-4">
                              <Activity size={11} style={{ color: meta.color }} /> Constraints
                            </h4>
                            <ul className="space-y-2">
                              {mission.constraints?.map((c: string, i: number) => (
                                <li key={i} className="text-[12px] text-claude-text/55 font-mono">
                                  <span className="opacity-40" style={{ color: meta.color }}>» </span>{c}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase text-claude-muted mb-4">
                              <CheckCircle2 size={11} className="text-green-400" /> Examples
                            </h4>
                            <div className="space-y-3">
                              {mission.test_cases?.slice(0, 2).map((tc: any, i: number) => (
                                <div key={i} className="p-3.5 bg-black/30 rounded-xl border border-claude-border/20 font-mono text-[11px] overflow-hidden">
                                  <div className="text-claude-text/40 mb-1 break-all whitespace-pre-wrap">in: {tc.input}</div>
                                  <div className="break-all whitespace-pre-wrap" style={{ color: meta.color }}>out: {tc.output}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="whiteboard"
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        className="h-full"
                      >
                        <Whiteboard color={meta.color} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* ── CODING EDITOR overlay */}
          <AnimatePresence>
            {phase === "coding" && (
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 220 }}
                className="absolute inset-0 z-50 p-4 bg-claude-bg flex flex-col gap-3">
                <div className="flex-1 flex gap-3 min-h-0">
                  <div className="w-64 border border-claude-border/40 bg-claude-panel rounded-2xl p-5 overflow-y-auto shrink-0 flex flex-col gap-4 shadow-xl">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: meta.color }}>{meta.label} · Coding Phase</span>
                      <h2 className="text-sm font-bold text-white mt-1 leading-tight">{mission.name}</h2>
                    </div>
                    <p className="text-[10px] text-claude-text/40 italic border-l-2 pl-3"
                      style={{ borderColor: meta.color + "40" }}>
                      {mission.description}
                    </p>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-claude-muted/50 mb-2">Constraints</p>
                      <ul className="space-y-1 mb-4">
                        {mission.constraints?.map((c: string, i: number) => (
                          <li key={i} className="text-[9px] font-mono text-claude-text/40 leading-tight">{c}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-claude-muted/50 mb-2">Examples</p>
                      <div className="space-y-2">
                        {mission.test_cases?.slice(0, 2).map((tc: any, i: number) => (
                          <div key={i} className="p-2 bg-black/30 rounded-lg border border-white/5 font-mono text-[9px] overflow-hidden">
                            <div className="text-claude-text/30 mb-1 break-all whitespace-pre-wrap">in: {tc.input}</div>
                            <div className="break-all whitespace-pre-wrap" style={{ color: meta.color + "cc" }}>out: {tc.output}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{ borderColor: meta.color + "30", background: meta.color + "08" }}>
                      <Zap size={9} style={{ color: meta.color }} />
                      <span className="text-[8px] font-bold uppercase tracking-wider"
                        style={{ color: meta.color + "cc" }}>
                        {meta.label} is watching
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 bg-claude-panel border border-claude-border/60 rounded-2xl overflow-hidden flex flex-col min-w-0 relative shadow-2xl">
                    <div className="h-10 bg-claude-hover/30 border-b border-claude-border/30 flex items-center justify-between px-5 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-claude-muted">Secure Sandbox</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={submitCode}
                          className="px-5 py-1 text-black text-[10px] font-black uppercase tracking-widest rounded-full transition-all hover:brightness-110 active:scale-95"
                          style={{ background: meta.color }}>
                          Submit Code →
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0">
                      <MissionEditor activeMission={mission} onCodeChange={setCurrentCode} flush isInterview={true} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </section>
  );
}
