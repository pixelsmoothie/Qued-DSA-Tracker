"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "./types";

interface InterviewSidebarProps {
  meta: any;
  messages: Message[];
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  inputVal: string;
  setInputVal: (v: string) => void;
  toggleMic: () => void;
  handleUserSpeech: (t: string) => void;
  phase: string;
}

export default function InterviewSidebar({
  meta,
  messages,
  isSpeaking,
  isListening,
  isThinking,
  inputVal,
  setInputVal,
  toggleMic,
  handleUserSpeech,
  phase,
}: InterviewSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thinkingTime, setThinkingTime] = React.useState(0);

  useEffect(() => {
    let interval: any;
    if (isThinking) {
      setThinkingTime(0);
      interval = setInterval(() => setThinkingTime(t => t + 1), 100);
    } else {
      setThinkingTime(0);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  return (
    <motion.aside
      initial={{ x: 0, opacity: 1 }}
      exit={{ x: -380, opacity: 0, width: 0 }}
      transition={{ duration: 0.4, ease: "circOut" }}
      className="w-[380px] border-r border-claude-border bg-claude-panel/40 flex flex-col shrink-0 overflow-hidden"
    >
      {/* Avatar Section */}
      <div className="h-48 flex flex-col items-center justify-center border-b border-claude-border/30 shrink-0"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${meta.color}10 0%, transparent 70%)` }}>
        <motion.div
          animate={{ scale: isSpeaking ? [1, 1.10, 1] : isListening ? [1, 1.04, 1] : 1 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-24 h-24 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: isSpeaking ? meta.color : isListening ? "#4ade80" : "#ffffff15",
            background:  isSpeaking ? `${meta.color}15` : isListening ? "#4ade8010" : "#ffffff05",
          }}>
          <span className="text-4xl select-none">{meta.emoji}</span>
        </motion.div>
        <div className="mt-3 text-center">
          <p className="text-sm font-bold text-white">{meta.label} Interviewer</p>
          <p className="text-[9px] text-claude-muted uppercase tracking-[0.2em] mt-0.5">{meta.subtitle}</p>
          <p className={`text-[9px] font-bold mt-1.5 uppercase tracking-widest ${
            isSpeaking ? "text-claude-accent" : isListening ? "text-green-400" : "text-claude-muted/30"
          }`}>
            {isSpeaking ? "● Speaking" : isListening ? "● Listening" : "○ Idle"}
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[93%] px-3.5 py-3 rounded-2xl text-[12px] leading-relaxed border ${
                  m.role === "user"
                    ? "bg-claude-hover/50 border-claude-border/40 rounded-tr-sm"
                    : "bg-claude-panel border-claude-border/30 rounded-tl-sm chat-bubble-glow"
                }`}
                style={m.role === "assistant" ? { borderColor: meta.color + "25" } : {}}>
                <div className={m.role === "assistant" ? "assistant-message" : ""}>
                  {!m.content ? (
                    <div className="flex gap-1.5 py-1 items-center opacity-40">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.3)]" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.3)]" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.3)]" />
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
              <span className="text-[9px] text-claude-muted/30 mt-1 px-1">
                {m.role === "user" ? "You" : meta.label}
              </span>
            </motion.div>
          ))}

        </AnimatePresence>
      </div>

      {/* Input / Control Area */}
      <div className="border-t border-claude-border bg-black/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            disabled={isSpeaking || isThinking}
            className={`p-2.5 rounded-xl shrink-0 transition-all ${
              isListening
                ? "bg-green-500/20 text-green-400 animate-pulse"
                : "bg-claude-hover text-claude-muted hover:bg-claude-hover/80"
            }`}>
            {isListening ? <Mic size={15} /> : <MicOff size={15} />}
          </button>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder={phase === "coding" ? "Ask a question…" : "Type or Space to speak…"}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              disabled={isThinking || isSpeaking}
              className="flex-1 bg-claude-bg/60 border border-claude-border/50 rounded-xl px-3 py-2 text-[11px] focus:outline-none focus:border-claude-accent/60 transition-all placeholder:text-claude-muted/30 disabled:opacity-40"
              onKeyDown={e => {
                if (e.key === "Enter" && inputVal.trim() && !isThinking && !isSpeaking) {
                  handleUserSpeech(inputVal.trim());
                  setInputVal("");
                }
              }}
            />
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
