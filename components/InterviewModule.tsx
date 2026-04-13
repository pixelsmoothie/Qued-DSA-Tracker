"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Square, Activity, Clock, Sparkles, MessageSquare } from "lucide-react";
import { getMissionDetails, getDb } from "../lib/db";
import { INTERVIEWER_SYSTEM_PROMPT, PERSONA_META, InterviewerPersona } from "../lib/prompts";

// Sub-components
import { Phase, Message, PHASES_ORDERED, PHASE_LABELS } from "./interview/types";
import PersonaSelect from "./interview/PersonaSelect";
import InterviewSidebar from "./interview/InterviewSidebar";
import Workspace from "./interview/Workspace";
import { streamCoreResponse } from "../lib/core_api";
import { addToInventory } from "../lib/db";

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function InterviewModule({
  onExit,
  apiProvider = "ollama",
  externalApiKey = "",
  externalModel = "",
  baseUrl = ""
}: {
  onExit: () => void,
  apiProvider?: "ollama" | "ollama_cloud" | "openrouter" | "groq",
  externalApiKey?: string,
  externalModel?: string,
  baseUrl?: string
}) {
  // ── Core state
  const [invoke, setInvoke] = useState<any>(null);
  const [bridgeReady, setBridgeReady] = useState(false);

  const [phase, setPhase] = useState<Phase>("persona_select");
  const [persona, setPersona] = useState<InterviewerPersona>("senior");
  const [selectedModel, setSelectedModel] = useState("qwen3:8b");
  const [mission, setMission] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(2700);
  const [timerActive, setTimerActive] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [autoMicEnabled, setAutoMicEnabled] = useState(true);
  const [neuralMode, setNeuralMode] = useState(true);
  const [inputVal, setInputVal] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [analysisStartIdx, setAnalysisStartIdx] = useState<number>(-1);
  const [finalReviewActive, setFinalReviewActive] = useState(false);
  const [finalReviewTimer, setFinalReviewTimer] = useState(60);
  const [lastTestResults, setLastTestResults] = useState<{ passed: number, total: number } | null>(null);

  // ── Refs
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const handlerRef = useRef<((t: string, n?: boolean) => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isCurrentlySpeakingRef = useRef(false);
  const spokenQueueRef = useRef<string[]>([]);
  const finalReportTriggeredRef = useRef(false);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      synthRef.current?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  // Mirror refs
  const messagesRef = useRef<Message[]>([]);
  const phaseRef = useRef<Phase>("persona_select");
  const personaRef = useRef<InterviewerPersona>("senior");
  const modelRef = useRef("qwen3:8b");
  const currentCodeRef = useRef("");
  const autoMicRef = useRef(true);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const neuralModeRef = useRef(true);
  const finalReviewActiveRef = useRef(false);

  // Stress Engine Ref
  const lastInterruptionTimeRef = useRef(Date.now());

  // Turn counters
  const stuckTurnsRef = useRef(0);
  const planningTurnsRef = useRef(0);
  const analysisTurnsRef = useRef(0);

  // Sync refs
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { personaRef.current = persona; }, [persona]);
  useEffect(() => { modelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { currentCodeRef.current = currentCode; }, [currentCode]);
  useEffect(() => { autoMicRef.current = autoMicEnabled; }, [autoMicEnabled]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { neuralModeRef.current = neuralMode; }, [neuralMode]);
  useEffect(() => { finalReviewActiveRef.current = finalReviewActive; }, [finalReviewActive]);

  // ── Handlers
  const triggerGrading = useCallback(() => {
    if (phaseRef.current === "grading") return;
    synthRef.current?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    spokenQueueRef.current = [];
    isCurrentlySpeakingRef.current = false;
    setPhase("grading");
    setFinalReviewActive(false);
    setTimerActive(false);
  }, []);

  const goToGrading = useCallback(() => {
    setPhase("grading");
    setFinalReviewActive(false);
  }, []);

  const forceCodingPhase = useCallback(() => {
    if (phaseRef.current === "coding") return;
    setPhase("coding");
    setTimerActive(true);
    stuckTurnsRef.current = 0;
    planningTurnsRef.current = 0;
    lastInterruptionTimeRef.current = Date.now();
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current || isSpeakingRef.current) return;
    try { recognitionRef.current.start(); setIsListening(true); } catch { /* active */ }
  }, []);

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListeningRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      startListening();
    }
  }, [startListening]);

  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (finalReviewActiveRef.current) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    synthRef.current?.cancel();

    const clean = text.replace(/[*#`_~]/g, "").replace(/[()[\]{}]/g, "").trim();
    if (!clean) { onEnd?.(); return; }

    const afterSpeak = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onEnd?.();
      if (autoMicRef.current && phaseRef.current !== "grading" && phaseRef.current !== "persona_select") {
        setTimeout(startListening, 300); // Small buffer to ensure audio tail is gone
      }
    };

    if (neuralModeRef.current && bridgeReady && invoke) {
      try {
        if (isListeningRef.current) { recognitionRef.current?.stop(); setIsListening(false); isListeningRef.current = false; }
        setIsSpeaking(true); isSpeakingRef.current = true;
        const data: string = await invoke("speak_neural", { text: clean });
        const audio = new Audio(data);
        audioRef.current = audio;
        audio.onended = () => { audioRef.current = null; afterSpeak(); };
        audio.onerror = () => {
          audioRef.current = null;
          setNeuralMode(false); neuralModeRef.current = false;
          afterSpeak();
        };
        await audio.play();
        return;
      } catch {
        setIsSpeaking(false); isSpeakingRef.current = false;
        setNeuralMode(false); neuralModeRef.current = false;
      }
    }

    if (!synthRef.current) { onEnd?.(); return; }
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.0;
    const voices = synthRef.current.getVoices();
    const v = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Neural") || v.name.includes("Natural")))
      || voices.find(v => v.lang.startsWith("en"));
    if (v) u.voice = v;
    u.onstart = () => { setIsSpeaking(true); isSpeakingRef.current = true; if (isListeningRef.current) recognitionRef.current?.stop(); };
    u.onend = afterSpeak;
    u.onerror = afterSpeak;
    synthRef.current.speak(u);
  }, [bridgeReady, startListening]);

  const processSpeechQueue = useCallback(() => {
    if (spokenQueueRef.current.length === 0) { isCurrentlySpeakingRef.current = false; return; }
    isCurrentlySpeakingRef.current = true;
    const next = spokenQueueRef.current.shift()!;
    speak(next, () => processSpeechQueue());
  }, [speak]);

  const queueSpeak = useCallback((text: string) => {
    if (finalReviewActiveRef.current) return;
    const clean = text.trim();
    if (!clean) return;
    spokenQueueRef.current.push(clean);
    if (!isCurrentlySpeakingRef.current) processSpeechQueue();
  }, [processSpeechQueue]);

  const handleUserSpeech = useCallback(async (transcript: string, isInternal = false) => {
    if (!mission) return;
    const trimmed = transcript.trim();
    if (!trimmed) return;

    // Barge-in Logic: If user speaks, stop the AI immediately
    if (isSpeakingRef.current && !isInternal) {
      synthRef.current?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      spokenQueueRef.current = [];
      isCurrentlySpeakingRef.current = false;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!isInternal) {
      setMessages(prev => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    }

    let effectivePhase: Phase = phaseRef.current;
    if (effectivePhase === "intro") {
      effectivePhase = "planning";
      setPhase("planning");
      planningTurnsRef.current = 0;
      stuckTurnsRef.current = 0;
    }

    const meaningful = wordCount(trimmed) > 10;
    if (effectivePhase === "planning") planningTurnsRef.current += 1;
    if (effectivePhase === "analysis" && meaningful) analysisTurnsRef.current += 1;
    stuckTurnsRef.current = wordCount(trimmed) <= 5 ? stuckTurnsRef.current + 1 : 0;

    const systemPrompt = INTERVIEWER_SYSTEM_PROMPT(mission, effectivePhase, personaRef.current, stuckTurnsRef.current, analysisTurnsRef.current);
    const gradingPressure = effectivePhase === "analysis" && analysisTurnsRef.current >= 5
      ? "\n\nINSTRUCTION: You have conducted enough analysis. Wrap up with 'I have enough. Let's wrap up.' and give nothing else."
      : "";

    setIsThinking(true);
    let fullResponse = "";
    let sentenceBuffer = "";

    try {
      const response = await streamCoreResponse({
        apiProvider,
        messages: [
          { role: "system", content: systemPrompt + gradingPressure },
          ...messagesRef.current.slice(-12),
          { role: "user", content: `(PHASE: ${effectivePhase.toUpperCase()}) ${trimmed}` + (currentCodeRef.current ? `\n\n[LIVE CODE]:\n\`\`\`\n${currentCodeRef.current}\n\`\`\`` : "") },
        ],
        externalApiKey,
        externalModel,
        localModel: modelRef.current,
        baseUrl,
        signal: abortRef.current?.signal,
        onStatus: (msg, sec) => {
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

      setMessages(prev => {
        // Clear any leftover retry indicators
        return prev.filter(m => !m.content.includes("Core Bridge"));
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);

        // Handle both Ollama (line-by-line JSON) and OpenAI (SSE data: prefix) formats
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          let token = "";

          try {
            if (apiProvider === "ollama" || apiProvider === "ollama_cloud") {
              const json = JSON.parse(line);
              token = json.message?.content ?? "";
            } else {
              // OpenRouter and Groq both follow standard OpenAI SSE format
              if (line.startsWith("data: ")) {
                const dataPart = line.substring(6);
                if (dataPart === "[DONE]") continue;
                const json = JSON.parse(dataPart);
                token = json.choices?.[0]?.delta?.content ?? "";
              }
            }

            if (!token) continue;
            fullResponse += token;

            const isInThink = fullResponse.includes("<think>") && !fullResponse.includes("</think>");
            if (token === "<think>") setIsThinking(true);
            if (token === "</think>") setIsThinking(false);

            const cleaned = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
            setMessages(prev => {
              const next = [...prev];
              if (next.length > 0) {
                next[next.length - 1] = { 
                  role: "assistant", 
                  content: cleaned || (isInThink ? "_The interviewer is thinking..._" : "") 
                };
              }
              return next;
            });

            const tokenClean = token.replace(/<think>[\s\S]*?<\/think>/g, "");
            sentenceBuffer += tokenClean;
            if (/[.?!,;]/.test(token)) {
              queueSpeak(sentenceBuffer);
              sentenceBuffer = "";
            }

            if (effectivePhase === "planning" && /editor|begin coding|implement|write the code|ready to code|let's code|solve it/i.test(cleaned)) {
              forceCodingPhase();
            }
          } catch (e) { /* partial json skip */ }
        }
      }
      if (sentenceBuffer.trim()) queueSpeak(sentenceBuffer);

      if (effectivePhase === "planning" && /editor|coding|implement|write code/i.test(fullResponse)) forceCodingPhase();
      if (effectivePhase === "analysis" && /wrap up|final grade|verdict|score/i.test(fullResponse)) triggerGrading();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Neural Error:", err);

      const providerLabel = apiProvider.replace("_", " ").toUpperCase();
      const actualModelUsed = (apiProvider === "ollama")
        ? modelRef.current
        : (externalModel || (apiProvider === "openrouter" ? "qwen/qwen-2.5-72b-instruct" : "llama-3.1-70b-versatile"));

      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ **${providerLabel} Core Link Failure**: ${err.message || "Connection failed"}.\n\nModel: \`${actualModelUsed}\``
      }]);
    } finally {
      setIsThinking(false);
    }
  }, [mission, queueSpeak, forceCodingPhase, triggerGrading]);

  const startInterview = useCallback((p: InterviewerPersona, m: any) => {
    const welcome = PERSONA_META[p].intro(m.name);
    setMessages([{ role: "assistant", content: welcome }]);
    speak(welcome);
    setPhase("intro");
  }, [speak]);

  const submitCode = useCallback(() => {
    if (phaseRef.current !== "coding") return;
    setPhase("analysis");
    setTimerActive(false);
    analysisTurnsRef.current = 0;
    setAnalysisStartIdx(messagesRef.current.length + 1);
    const reviewPrompt = `[SUBMISSION] Candidate finished coding in C++.
Implementation:
\`\`\`cpp
${currentCodeRef.current}
\`\`\`
Conduct a deep technical peer-review now.`;
    handleUserSpeech(reviewPrompt, true);
  }, [handleUserSpeech]);

  useEffect(() => { handlerRef.current = (t, n) => handleUserSpeech(t, n); });

  // ── Tauri bridge
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("@tauri-apps/api/core")
      .then(m => {
        setInvoke(() => m.invoke);
        setBridgeReady(true);
      })
      .catch(() => setBridgeReady(false));
  }, []);

  // ── Mission load
  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const rows: any[] = await db.select(
          "SELECT id FROM missions WHERE status = 'solved' ORDER BY RANDOM() LIMIT 1"
        );
        if (rows.length > 0) setMission(await getMissionDetails(rows[0].id));
      } catch (e) { console.error("Mission load:", e); }
    })();
  }, []);

  // ── Recognition setup
  useEffect(() => {
    if (typeof window === "undefined") return;
    synthRef.current = window.speechSynthesis;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e: any) => handlerRef.current?.(e.results[0][0].transcript);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;

    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try { rec.stop(); } catch (e) { }
    };
  }, []);

  // ── Stress Engine (90s Cadence)
  useEffect(() => {
    if (phase !== "coding") return;
    const timer = setInterval(() => {
      if (isThinking || isSpeaking || isListening) return;
      const now = Date.now();
      if ((now - lastInterruptionTimeRef.current) > 90000) {
        lastInterruptionTimeRef.current = now;
        handleUserSpeech(`[INTERRUPTION] Senior Lead probes your implementation. 
CURRENT CODE:
\`\`\`cpp
${currentCodeRef.current}
\`\`\`
Ask a sharp, technical question about a specific line or logic block. Max 15 words.`, true);
      }
    }, 10000); // Check heartbeat every 10s
    return () => clearInterval(timer);
  }, [phase, isThinking, isSpeaking, isListening, handleUserSpeech]);

  // ── PTT & Timers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && phaseRef.current !== "coding" && phaseRef.current !== "persona_select") {
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          e.preventDefault(); toggleMic();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMic]);

  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(id);
  }, [timerActive, timeLeft]);

  useEffect(() => {
    if (!finalReviewActive) return;
    if (finalReviewTimer <= 0) { goToGrading(); return; }
    const id = setInterval(() => setFinalReviewTimer(p => p - 1), 1000);
    return () => clearInterval(id);
  }, [finalReviewActive, finalReviewTimer, goToGrading]);

  useEffect(() => {
    if (phase === "grading" && !isThinking && !finalReportTriggeredRef.current) {
      finalReportTriggeredRef.current = true;
      handleUserSpeech(`(SYSTEM: Generate the Technical Assessment Report now.)`, true);
    }
  }, [phase, isThinking, handleUserSpeech]);

  const runCode = useCallback(async (code: string, input: string) => {
    try {
      if (!invoke) return { stdout: "", stderr: "Core Bridge not ready", exit_code: 1 };
      return await invoke("run_code", { code, input, language: "cpp" });
    } catch (e: any) {
      return { stdout: "", stderr: `Error: ${e.message}`, exit_code: 1 };
    }
  }, [invoke]);

  const downloadReview = useCallback(() => {
    const msgs = messagesRef.current.slice(analysisStartIdx).filter(m => m.role === "assistant");
    const text = msgs.map(m => m.content).join("\n\n");
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "review.txt"; a.click();
    URL.revokeObjectURL(url);
  }, [analysisStartIdx]);

  const saveReportToInventory = useCallback(async () => {
    const reportMsg = messagesRef.current.filter(m => m.role === "assistant").pop();
    if (!reportMsg || !mission) return;

    await addToInventory(
      "report",
      `Interview Report: ${mission.name} (${personaRef.current})`,
      reportMsg.content,
      { mission_id: mission.id, persona: personaRef.current, date: new Date().toISOString() }
    );
    alert("Report saved to Neural Inventory.");
  }, [mission]);

  // UI Helpers
  const meta = PERSONA_META[persona];
  const phaseIdx = PHASES_ORDERED.indexOf(phase);
  const analysisAssistantMsgs = analysisStartIdx >= 0 ? messages.slice(analysisStartIdx).filter(m => m.role === "assistant") : [];
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const timerColor = timeLeft < 300 ? "text-red-400" : timerActive ? "text-claude-accent" : "text-claude-muted";

  if (phase === "persona_select") {
    return (
      <PersonaSelect
        persona={persona} setPersona={setPersona}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
        mission={mission} onBegin={(p) => startInterview(p, mission)} onExit={onExit}
        apiProvider={apiProvider as any} externalModel={externalModel}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-claude-bg text-claude-text overflow-hidden border border-claude-border rounded-2xl relative z-50">
      <header className="h-14 border-b border-claude-border px-8 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg border" style={{ borderColor: meta.color + "40" }}>
            <span>{meta.emoji}</span>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</span>
          </div>
          <nav className="flex items-center gap-2">
            {PHASES_ORDERED.map((p, i) => (
              <span key={p} className={`text-[9px] font-bold uppercase ${phase === p ? "text-white" : "text-claude-muted/30"}`}>{PHASE_LABELS[p]}</span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${timerColor}`}>
            <Clock size={12} /> <span className="text-[13px] font-mono font-bold">{formatTime(timeLeft)}</span>
          </div>
          <button onClick={onExit} className="p-2 hover:text-red-400"><Square size={15} /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <AnimatePresence>
          {!finalReviewActive && phase !== "grading" && (
            <InterviewSidebar
              meta={meta} messages={messages} isSpeaking={isSpeaking} isListening={isListening} isThinking={isThinking}
              inputVal={inputVal} setInputVal={setInputVal} toggleMic={toggleMic}
              handleUserSpeech={handleUserSpeech} phase={phase}
            />
          )}
        </AnimatePresence>
        <Workspace
          phase={phase} mission={mission} meta={meta} messages={messages}
          isThinking={isThinking} currentCode={currentCode} setCurrentCode={setCurrentCode}
          analysisAssistantMsgs={analysisAssistantMsgs} finalReviewActive={finalReviewActive} finalReviewTimer={finalReviewTimer}
          downloadReview={downloadReview} goToGrading={goToGrading} submitCode={submitCode}
          runCode={runCode} onTestsComplete={() => { }} forceCodingPhase={forceCodingPhase}
          saveReportToInventory={saveReportToInventory}
        />
      </main>
    </div>
  );
}
