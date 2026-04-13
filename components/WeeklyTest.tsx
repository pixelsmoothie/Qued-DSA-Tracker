"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, CheckCircle2, Loader2, Send, Save, AlertCircle, ChevronRight, ChevronLeft, TerminalSquare, Activity, Code2, Monitor, Trophy, Play, X, RefreshCw } from "lucide-react";
import { getWeeklyTestQuestions } from "../lib/db";
import { executeCode, fetchLeetcodeTemplate } from "../lib/remote_actions";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TestCase {
  input: string;
  output: string;
}

interface Question {
  id: number;
  name: string;
  topic: string;
  difficulty: string;
  leetcode_url: string;
  constraints?: string[];
  test_cases?: TestCase[];
  cpp_main?: string;
  description?: string;
}

const STARTER: Record<string, string> = {
  cpp: "// C++ Implementation\n#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    \n};\n\nint main() {\n    Solution sol;\n    return 0;\n}\n",
  java: "// Java Implementation\nimport java.util.*;\n\nclass Solution {\n    \n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Solution sol = new Solution();\n    }\n}\n",
  python: "# Python Implementation\nclass Solution:\n    def solve(self):\n        pass\n\nif __name__ == \"__main__\":\n    sol = Solution()\n",
  javascript: "// JS Implementation\nvar solve = function() {\n    \n};\n",
};

export default function WeeklyTest() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [templates, setTemplates] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [outputs, setOutputs] = useState<Record<number, string | null>>({});
  const [language, setLanguage] = useState("cpp");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [finalJudgement, setFinalJudgement] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [language]); // Reload templates if language changes

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const qs = await getWeeklyTestQuestions();
      setQuestions(qs);

      // Fetch templates for each question in parallel
      const templateMap: Record<number, string> = {};
      await Promise.all(qs.map(async (q) => {
        // Priority 1: Use pre-defined cpp_main if available for C++
        if (language === 'cpp' && q.cpp_main) {
          templateMap[q.id] = q.cpp_main;
          return;
        }

        // Priority 2: Use LeetCode snippet and wrap it if needed (at least in C++ and Java)
        if (q.leetcode_url) {
          const snippet = await fetchLeetcodeTemplate(q.leetcode_url, language);
          let finalCode = snippet || STARTER[language] || "// Start coding...\n";

          if (language === 'cpp' && !finalCode.includes('main(')) {
            finalCode += "\n\nint main() {\n    Solution sol;\n    // Write test calls here\n    return 0;\n}\n";
          } else if (language === 'java' && !finalCode.includes('main(')) {
            finalCode += "\n\npublic class Main {\n    public static void main(String[] args) {\n        Solution sol = new Solution();\n    }\n}\n";
          }

          templateMap[q.id] = finalCode;
        } else {
          templateMap[q.id] = STARTER[language] || "// Start coding...\n";
        }
      }));
      setTemplates(templateMap);

      // Initialize responses with templates if they are empty
      setResponses(prev => {
        const newResponses = { ...prev };
        qs.forEach(q => {
          if (!newResponses[q.id]) {
            newResponses[q.id] = templateMap[q.id];
          }
        });
        return newResponses;
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (val: string | undefined) => {
    if (val === undefined) return;
    const qId = questions[currentStep].id;
    setResponses(prev => ({ ...prev, [qId]: val }));
  };

  const handleRun = async () => {
    const qId = questions[currentStep].id;
    const code = responses[qId];
    setRunning(true);
    setOutputs(prev => ({ ...prev, [qId]: "Initiating remote execution..." }));

    try {
      const res = await executeCode(language, code);
      if (res.error) {
        setOutputs(prev => ({ ...prev, [qId]: `[ERROR]\n${res.error}` }));
      } else {
        setOutputs(prev => ({ ...prev, [qId]: res.output || "[SUCCESS] Execution completed. No terminal output." }));
      }
    } catch (e) {
      setOutputs(prev => ({ ...prev, [qId]: "[ERROR] Remote execution timed out." }));
    } finally {
      setRunning(false);
    }
  };

  const submitAll = async () => {
    setSubmitting(true);
    try {
      let fullPrompt = `You are an expert DSA Interviewer. Please provide a comprehensive evaluation of the user's weekly performance review. 
      They have answered ${questions.length} questions from their recent completed missions.
      
      EVALUATION TASKS:
      1. Review each question's response for correctness and complexity.
      2. Provide a "Mastery Rating" for each topic.
      3. Identify general patterns in their mistakes (if any).
      4. Give a final "Go/No-Go" status for the next week of content.
      
      QUESTIONS AND RESPONSES:
      \n`;

      questions.forEach((q, idx) => {
        fullPrompt += `[${idx + 1}] QUESTION: ${q.name} (${q.topic})
        USER RESPONSE: ${responses[q.id] || "No response provided."}
        ---
        \n`;
      });

      fullPrompt += "\nFormat your entire feedback with clear markdown headers and sections. Keep it professional and technical.";

      const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-coder:3b",
          messages: [{ role: "user", content: fullPrompt }],
          stream: false
        }),
      });

      if (!res.ok) throw new Error("Ollama error");
      const data = await res.json();
      setFinalJudgement(data.message.content);
      setCurrentStep(questions.length);
    } catch (error) {
      setFinalJudgement("Failed to reach AI. Ensure Ollama is running and the model is loaded.");
      setCurrentStep(questions.length);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-claude-muted bg-claude-bg">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
          <Brain size={48} className="text-claude-accent" />
        </motion.div>
        <p className="mt-6 text-xs uppercase tracking-[0.4em] font-bold">Integrating Runnable Environments...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-claude-muted bg-claude-bg p-10 text-center">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-medium text-claude-text mb-2">No Completed Missions Detected</h2>
        <p className="max-w-md text-sm">To take this test, you must finish at least one mission by clicking the completion checkmark during your daily cycle.</p>
        <button
          onClick={loadQuestions}
          className="mt-8 flex items-center gap-2 px-6 py-2.5 bg-claude-accent/10 text-claude-accent border border-claude-accent/20 rounded-xl text-xs font-bold hover:bg-claude-accent/20 transition-all uppercase tracking-widest"
        >
          <RefreshCw size={14} /> Refresh Search
        </button>
      </div>
    );
  }

  // REVIEW PAGE
  if (currentStep === questions.length) {
    return (
      <div className="h-full overflow-y-auto bg-claude-bg p-10 selection:bg-claude-accent/30 selection:text-white">
        <div className="max-w-4xl mx-auto pb-32">
          <div className="flex items-center gap-4 mb-12 border-b border-claude-border pb-8">
            <div className="w-16 h-16 rounded-3xl bg-claude-accent/10 border border-claude-accent/20 flex items-center justify-center">
              <Trophy size={32} className="text-claude-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Weekly Performance Report</h1>
              <p className="text-claude-muted text-sm tracking-wide uppercase font-bold opacity-60">System Assessment Cycle Stable</p>
            </div>
          </div>

          <div className="bg-claude-panel border border-claude-accent/20 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-claude-accent/50 to-transparent" />
            <div className="prose prose-invert prose-sm max-w-full break-words whitespace-pre-wrap">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {finalJudgement || "Analysis stream lost."}
              </ReactMarkdown>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-12 text-sm font-bold uppercase tracking-widest text-claude-muted hover:text-white transition-colors flex items-center gap-2"
          >
            <ChevronLeft size={16} /> Finish Review Cycle
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentStep];
  const currentCode = responses[q.id];
  const currentOutput = outputs[q.id] || null;

  return (
    <div className="h-full flex flex-col bg-claude-bg selection:bg-claude-accent/30 selection:text-white overflow-hidden">

      {/* Header / Progress Bar */}
      <header className="h-16 border-b border-claude-border bg-claude-panel/50 px-8 flex items-center justify-between shrink-0 mb-px">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-claude-accent">
            <Brain size={20} strokeWidth={2.5} />
            <span className="text-xs font-black uppercase tracking-[0.4em]">ASSESSMENT MODE</span>
          </div>
          <div className="h-4 w-px bg-claude-border" />
          <div className="flex gap-1.5">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-8 rounded-full transition-all duration-300 ${idx === currentStep ? 'bg-claude-accent' : idx < currentStep ? 'bg-green-500' : 'bg-claude-border/50'}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-claude-border/30">
            {["cpp", "java", "python", "javascript"].map(l => (
              <button
                type="button"
                key={l}
                onClick={() => setLanguage(l)}
                className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded transition-all ${language === l ? 'bg-claude-accent text-white shadow-lg' : 'text-claude-muted hover:text-claude-text'}`}
              >
                {l === 'cpp' ? 'C++' : l.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-black tracking-widest uppercase text-claude-muted opacity-50">
            QUESTION {currentStep + 1} OF {questions.length}
          </div>
        </div>
      </header>

      {/* Main Multi-Pane Content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">

        {/* Left Pane: Question Details */}
        <motion.div
          key={`q-left-${q.id}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[420px] bg-claude-panel border border-claude-border/60 rounded-2xl flex flex-col shrink-0 overflow-hidden"
        >
          <div className="p-6 border-b border-claude-border/40 shrink-0 bg-claude-hover/5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-claude-accent/5 text-claude-accent border border-claude-accent/20 rounded">
                {q.topic}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${q.difficulty === 'Easy' ? 'bg-green-500/10 text-green-500 border-green-500/20' : q.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                {q.difficulty}
              </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white mb-2 leading-tight">{q.name}</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            {/* Description */}
            {q.description && (
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-muted mb-4 flex items-center gap-2">
                  <Activity size={12} /> Description
                </h4>
                <p className="text-[15px] text-claude-text/90 leading-relaxed italic border-l border-claude-accent/20 pl-2 py-1.5">
                  {q.description}
                </p>
              </div>
            )}

            {/* Constraints */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-muted mb-4 flex items-center gap-2">
                <Activity size={12} /> Constraints
              </h4>
              <ul className="space-y-2">
                {q.constraints && q.constraints.length > 0 ? q.constraints.map((c, i) => (
                  <li key={i} className="text-[13px] text-claude-text/70 flex gap-3 leading-relaxed">
                    <span className="text-claude-accent/50 shrink-0 select-none">•</span>
                    <span className="font-mono">{c}</span>
                  </li>
                )) : <li className="text-xs text-claude-muted italic">System data constraints available for this protocol.</li>}
              </ul>
            </div>

            {/* Examples / Test Cases */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-muted mb-4 flex items-center gap-2">
                <TerminalSquare size={12} /> Test Protocols
              </h4>
              <div className="space-y-4 pb-20">
                {q.test_cases && q.test_cases.length > 0 ? q.test_cases.slice(0, 2).map((tc, i) => (
                  <div key={i} className="bg-black/30 border border-claude-border/40 rounded-xl p-4 font-mono text-[11px] leading-relaxed">
                    <div className="flex gap-4 mb-2">
                      <span className="text-claude-accent/40 w-10 shrink-0 font-bold">INPUT</span>
                      <span className="text-claude-text/70 break-all">{tc.input}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-green-500/40 w-10 shrink-0 font-bold">OUT</span>
                      <span className="text-green-500/70 break-all">{tc.output}</span>
                    </div>
                  </div>
                )) : <p className="text-xs text-claude-muted italic">Analyze question logic then proceed.</p>}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Pane: Monaco Editor Interface */}
        <motion.div
          key={`q-right-${q.id}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 bg-claude-panel border border-claude-border/60 rounded-2xl flex flex-col overflow-hidden relative"
        >
          <div className="h-10 px-6 border-b border-claude-border/40 flex items-center justify-between shrink-0 bg-claude-hover/10">
            <div className="flex items-center gap-2 px-1">
              <Code2 size={13} className="text-claude-muted" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-claude-muted opacity-80">Workspace ID: {q.id}</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 text-[10px] font-black uppercase tracking-tighter transition-all disabled:opacity-50"
              >
                {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} className="fill-current" />}
                Run Code
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language === 'javascript' ? 'javascript' : language === 'python' ? 'python' : 'java'}
                theme="vs-dark"
                value={currentCode}
                onChange={handleResponseChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                  padding: { top: 20, bottom: 20 },
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                }}
              />
            </div>

            {/* Console Output Overlap */}
            <AnimatePresence>
              {currentOutput && (
                <motion.div
                  initial={{ y: 200 }}
                  animate={{ y: 0 }}
                  exit={{ y: 200 }}
                  className="absolute bottom-0 left-0 right-0 h-40 bg-[#080808] border-t border-claude-border/60 z-20 flex flex-col"
                >
                  <div className="px-4 py-2 bg-[#0a0a0a] border-b border-claude-border/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-claude-muted">
                      <TerminalSquare size={12} /> Remote Output
                    </div>
                    <button type="button" onClick={() => setOutputs(prev => ({ ...prev, [q.id]: null }))} className="text-claude-muted hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-auto font-mono text-[11px] leading-relaxed">
                    <pre className={currentOutput.includes("[ERROR]") ? "text-red-400" : "text-green-500/80"}>
                      {currentOutput}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <footer className="h-16 px-6 border-t border-claude-border/40 flex items-center justify-between shrink-0 bg-transparent">
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-claude-muted hover:text-white disabled:opacity-0 transition-all font-sans"
            >
              <ChevronLeft size={16} /> Prev Q
            </button>

            {currentStep < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="flex items-center gap-2 pl-6 pr-4 py-2.5 bg-claude-accent text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg font-sans"
              >
                Next Question <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submitAll}
                disabled={submitting}
                className="flex items-center gap-2 pl-6 pr-6 py-2.5 bg-white text-claude-bg rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 font-sans"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? "Analyzing..." : "Finish Cycle"}
              </button>
            )}
          </footer >
        </motion.div>
      </div>
    </div>
  );
}
