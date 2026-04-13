"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, Loader2, Trash2, Copy, Check, Monitor,
  Activity, TerminalSquare, Mic, MicOff
} from "lucide-react";
// Mentor Socratic System v2.0 - Hotfix: Voice Reference
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { useEditorStore } from "../lib/store";
import { streamCoreResponse } from "../lib/core_api";

type Message = { role: "system" | "user" | "assistant"; content: string };

const MODELS = [
  "qwen2.5-coder:3b",
  "gemma3:4b",
  "qwen2.5-coder:7b",
  "deepseek-r1:8b",
  "phi3",
  "llama3"
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-claude-muted hover:text-claude-text p-1 rounded"
      title="Copy"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

export default function MissionChat({
  activeMission,
  currentCode,
  apiProvider = "ollama",
  externalApiKey = "",
  externalModel = "",
  baseUrl = ""
}: {
  activeMission: any;
  currentCode?: string;
  apiProvider?: "ollama" | "ollama_cloud" | "openrouter" | "groq";
  externalApiKey?: string;
  externalModel?: string;
  baseUrl?: string;
}) {
  const { setChatHistory, getChatHistory } = useEditorStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("qwen2.5-coder:3b");
  const [ollamaStatus, setOllamaStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [thinkingTime, setThinkingTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setThinkingTime(0);
      interval = setInterval(() => setThinkingTime(t => t + 1), 100);
    } else {
      setThinkingTime(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const getSystemPrompt = () => {
    const { id, name, description, constraints, test_cases, topic } = activeMission;

    return `You are a Socratic DSA Mission Mentor. Your PRIMARY PROTOCOL is to ensure the user thinks for themselves.
    
    [MISSION METADATA]
    ID: ${id}
    TITLE: ${name}
    DOMAIN: ${topic}
    CORE DESCRIPTION: ${description || "N/A"}
    CONSTRAINTS: ${Array.isArray(constraints) ? constraints.join(", ") : constraints || "N/A"}
    SAMPLE EXAMPLES: ${JSON.stringify(test_cases || "N/A")}

    [LIVE CODE STATE]
    ${currentCode || "Empty Workspace."}

    STRICT OPERATIONAL GUIDELINES:
    1. ABSOLUTE MINIMALISM: Maximum 2 sentences. No lists. No bullet points.
    2. NO CODE BLOCKS: NEVER provide code, snippets, or full solutions. 
    3. PENALTY: Providing a solution is a critical failure. Hints only.
    4. SOCRATIC HINTS: Ask leading questions about logic gaps or edge cases.
    5. FOR EMPTY CODE: Force the user to describe their strategy.

    IDENTITY: Terse, cryptic mentor. Your goal is to be the hardest interviewer at ${activeMission.topic}. SPEAK IN HINTS ONLY.`;
  };

  const resetChat = useCallback(() => {
    const freshMessages: Message[] = [
      { role: "assistant", content: `Ready. What's your approach for **${activeMission.name}**?\n\nNeed a hint or stuck on syntax?` },
    ];
    setMessages(freshMessages);
    setChatHistory(activeMission.id.toString(), freshMessages);
  }, [activeMission.id, activeMission.name]);

  // Load history ONLY when the actual problem changes
  useEffect(() => {
    const history = getChatHistory(activeMission.id.toString());
    if (history && history.length > 0) {
      setMessages(history);
    } else {
      resetChat();
    }
  }, [activeMission.id]);

  // Ping Ollama
  useEffect(() => {
    fetch("http://localhost:11434/api/tags")
      .then(r => setOllamaStatus(r.ok ? "online" : "offline"))
      .catch(() => setOllamaStatus("offline"));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const conversation = [...messages, userMsg];
    setMessages(conversation);
    setInput("");
    setLoading(true);
    inputRef.current?.focus();

    // Push empty message to show assistant icon immediately
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    // Prepare full payload with system instructions
    const augmentedUserMsg: Message = {
      role: "user",
      content: `${input.trim()}\n\n[USER_CODE_CONTEXT]\n${currentCode || "Empty Workspace."}\n[/USER_CODE_CONTEXT]`
    };

    const fullMessages: Message[] = [
      { role: "system", content: getSystemPrompt() },
      ...messages,
      augmentedUserMsg
    ];

    try {
      const response = await streamCoreResponse({
        apiProvider: apiProvider as any,
        messages: fullMessages,
        externalApiKey,
        externalModel,
        localModel: selectedModel,
        baseUrl,
        onStatus: (msg: string, sec: number) => {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            const statusStr = `⚠️ **Core Bridge (Busy)**: ${msg}. Retrying... [Elapsed: ${sec}s]`;
            if (last?.role === "assistant" && last.content.includes("Core Bridge")) {
              next[next.length - 1] = { role: "assistant", content: statusStr };
            } else {
              next.push({ role: "assistant", content: statusStr });
            }
            return next;
          });
        }
      });

      if (!response.ok) throw new Error("bad response");

      // Cleanup status indicator if it was there
      setMessages(prev => prev.filter(m => !m.content.includes("Core Bridge")));

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream body");

      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);

        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          let token = "";

          try {
            if (apiProvider === "ollama" || apiProvider === "ollama_cloud") {
              const json = JSON.parse(line);
              token = json.message?.content ?? "";
            } else {
              if (line.startsWith("data: ")) {
                const dataPart = line.substring(6).trim();
                if (dataPart === "[DONE]") continue;
                const json = JSON.parse(dataPart);
                token = json.choices?.[0]?.delta?.content ?? "";
              }
            }

            if (!token) continue;
            fullResponse += token;

            // DeepSeek-R1 <think> filtering
            const isInThink = fullResponse.includes("<think>") && !fullResponse.includes("</think>");
            const cleanedResponse = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

            setMessages(prev => {
              const next = [...prev];
              if (next.length > 0) {
                next[next.length - 1] = { 
                  role: "assistant", 
                  content: cleanedResponse || "" 
                };
              }
              return next;
            });
          } catch (e) { /* partial json skip */ }
        }
      }

      // Final save to store
      setChatHistory(activeMission.id.toString(), [...messages, userMsg, { role: "assistant", content: fullResponse }]);
      if (apiProvider === "ollama") setOllamaStatus("online");
    } catch (e: any) {
      if (apiProvider === "ollama") setOllamaStatus("offline");
      const errorMsg: Message = {
        role: "assistant",
        content: apiProvider === "ollama"
          ? "⚠ Could not reach Ollama on port 11434. Make sure it's running:\n\n`ollama serve`"
          : `⚠ Core Link Failure: ${e.message}. [Model: ${externalModel || apiProvider.toUpperCase()}]`,
      };
      const updatedHistoryWithErr = [...conversation, errorMsg];
      setMessages(updatedHistoryWithErr);
      setChatHistory(activeMission.id.toString(), updatedHistoryWithErr);
    } finally {
      setLoading(false);
    }
  };

  const startSpeechRecognition = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[ALGO MENTOR] Speech recognition NOT supported in this browser version.");
      alert("Speech recognition not supported in this environment.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log("[ALGO MENTOR] Voice recognition ACTIVATED. Listening...");
        setIsListening(true);
      };

      recognition.onend = () => {
        console.log("[ALGO MENTOR] Voice recognition ENDED.");
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error("[ALGO MENTOR] Recognition Event Error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone access denied. Please check your system/Tauri permissions.");
        }
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log("[ALGO MENTOR] SUCCESS: captured '" + transcript + "'");

        // Append to current input or set new
        setInput(current => {
          const updated = current.trim() ? `${current.trim()} ${transcript}` : transcript;
          console.log("[ALGO MENTOR] State update triggered. New input length:", updated.length);
          return updated;
        });

        setIsListening(false);
        // Force focus back to textarea
        setTimeout(() => inputRef.current?.focus(), 50);
      };

      recognition.start();
    } catch (e) {
      console.error("[ALGO MENTOR] Critical Start Error:", e);
      setIsListening(false);
    }
  };

  const visibleMessages = messages;

  return (
    <div className="flex-1 flex flex-col h-full bg-claude-bg overflow-hidden">
      {/* Header */}
      <div style={{ height: '32px', padding: '0 12px' }} className="flex items-center justify-between border-b border-claude-border/50 shrink-0 bg-claude-hover/10">
        <div className="flex items-center gap-2">
          {apiProvider === "ollama" ? (
            <>
              <div className={`w-1 h-1 rounded-full ${ollamaStatus === "online" ? "bg-green-400" : ollamaStatus === "offline" ? "bg-red-400" : "bg-claude-muted"}`} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-claude-muted/60">Mentor Mode:</span>
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                style={{ fontSize: '9px' }}
                className="bg-transparent font-bold uppercase tracking-widest text-claude-muted/80 hover:text-claude-text focus:outline-none cursor-pointer transition-colors border-none p-0"
              >
                {MODELS.map(m => <option key={m} value={m} className="bg-claude-bg">{m}</option>)}
              </select>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.5)]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-claude-accent">
                {apiProvider.replace("_", " ").toUpperCase()} BRIDGE: {externalModel || "..."}
              </span>
              <span className="text-[8px] font-bold text-claude-muted/40 uppercase tracking-tighter opacity-60 px-1.5 py-0.5 rounded border border-claude-border/30">CLOUD ACTIVE</span>
            </>
          )}
        </div>
        <button
          onClick={resetChat}
          title="Clear chat"
          className="text-claude-muted/70 hover:text-claude-text transition-colors p-1.5 rounded-md hover:bg-claude-hover"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pl-2.5 pt-1.5 pr-7 pb-6 space-y-2 text-[13px] leading-relaxed">
        {visibleMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 group ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-claude-panel border border-claude-border flex items-center justify-center shrink-0 shadow-sm translate-x-[-1px] translate-y-[3px]">
                <Bot size={13} className="text-claude-accent" />
              </div>
            )}
            <div className={`max-w-[90%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {msg.role === "user" ? (
                <div className="px-5 py-3 rounded-2xl bg-claude-hover text-claude-text rounded-tr-sm border border-claude-accent/10 whitespace-pre-wrap">
                  {msg.content}
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none text-claude-text/90 leading-relaxed font-sans w-full translate-y-[4px]">
                  {!msg.content ? (
                    <div className="flex gap-1.5 py-1 items-center opacity-40 pl-1">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.3)]" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.3)]" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent shadow-[0_0_8px_rgba(218,119,86,0.3)]" />
                    </div>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: (props) => <p className="mb-0" {...props} />,
                        ul: (props) => <ul className="list-disc pl-6 mb-5 space-y-2.5" {...props} />,
                        ol: (props) => <ol className="list-decimal pl-6 mb-5 space-y-2.5" {...props} />,
                        li: (props) => <li className="pl-1" {...props} />,
                        code: ({ className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || "");
                          if (!match) {
                            return <code className="bg-claude-hover/50 text-claude-accent px-1.5 py-0.5 rounded font-mono text-[11.5px]" {...props}>{children}</code>;
                          }
                          return (
                            <div className="my-6 rounded-xl border-[2px] border-claude-border overflow-hidden bg-[#0d0d0d] shadow-lg">
                              <div className="px-4 py-2 bg-[#151515] border-b-[2px] border-claude-border flex justify-between items-center">
                                <span className="text-[10px] font-bold text-claude-muted uppercase tracking-widest">{match[1]}</span>
                              </div>
                              <pre className="p-5 overflow-x-auto font-mono text-[12px] leading-relaxed scrollbar-thin">
                                {children}
                              </pre>
                            </div>
                          );
                        },
                        strong: (props) => <strong className="font-bold text-white tracking-wide" {...props} />,
                        h1: (props) => <h1 className="text-xl font-bold mb-5 text-white" {...props} />,
                        h2: (props) => <h2 className="text-lg font-bold mb-4 text-white" {...props} />,
                        h3: (props) => <h3 className="text-md font-bold mb-3 text-white" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              )}
              <div className="mt-1 transition-opacity opacity-0 group-hover:opacity-100"><CopyButton text={msg.content} /></div>
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.content.includes("Retrying") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 pl-1 pt-4"
          >
            <span className="text-[10px] font-black text-claude-muted/40 uppercase tracking-[0.2em] flex items-center gap-2">
              ⚠️ {messages[messages.length - 1].content.split("Retrying")[0]} Retrying...
              <span className="text-claude-accent/30 font-mono">
                {(thinkingTime / 10).toFixed(1)}s
              </span>
            </span>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px' }} className="border-t border-claude-border shrink-0">
        <div className="flex gap-2 bg-claude-panel border border-claude-border rounded-xl pl-[10px] pr-1.5 min-h-[60px] py-1.5 focus-within:border-claude-accent/50 focus-within:ring-1 focus-within:ring-claude-accent/15 transition-all items-start">
          <textarea
            ref={inputRef as any}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask for a hint..."
            rows={1}
            className="flex-1 bg-transparent text-claude-text text-[12.5px] px-2 py-2 focus:outline-none placeholder-claude-muted/50 resize-none min-h-[40px] translate-x-[2px] translate-y-[2px]"
          />
          <div className="flex items-center gap-1 self-end mb-1 ml-auto">
            <button
              onClick={startSpeechRecognition}
              className={`p-1.5 rounded-md transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-claude-muted hover:text-claude-text hover:bg-claude-hover'}`}
              title="Voice to Text"
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-claude-text text-claude-bg p-1.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-claude-muted mt-1.5 pl-[8px] pr-1">Enter to send · Voice-to-Text active</p>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
