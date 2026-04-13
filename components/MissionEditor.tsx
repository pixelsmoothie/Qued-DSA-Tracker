"use client";

import Editor from "@monaco-editor/react";
import { useState, useEffect } from "react";
import { RotateCcw, Copy, Check, Loader2, Play, TerminalSquare, Minimize2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLeetcodeTemplate, executeCode } from "../lib/remote_actions";
import { useEditorStore } from "../lib/store";
import striversData from "../strivers_sde_sheet.json";
import { getInterviewDraft, saveInterviewDraft } from "../lib/db";

const STARTER: Record<string, string> = {
  cpp: `#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        // Your logic here\n    }\n};\n\nint main() {\n    Solution sol;\n    // Manual Testing\n    return 0;\n}`,
  python: `class Solution:\n    def solve(self):\n        # Your logic here\n        pass\n\nif __name__ == "__main__":\n    sol = Solution()\n    # Manual Testing`,
  java: `import java.util.*;\n\nclass Solution {\n    public void solve() {\n        // Your logic here\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Solution sol = new Solution();\n        // Manual Testing\n    }\n}`,
  javascript: `/**\n * @param {number[]} nums\n * @return {void}\n */\nvar solve = function(nums) {\n    // Your logic here\n};\n`,
  typescript: `function solve(nums: number[]): void {\n    // Your logic here\n}\n`,
  rust: `impl Solution {\n    pub fn solve(nums: Vec<i32>) {\n        // Your logic here\n    }\n}\n\nfn main() {\n    // Manual Testing\n}\n`,
};

const LANGS = Object.keys(STARTER);

export default function MissionEditor({
  activeMission, flush, onCodeChange, onCollapse, isInterview, language: langProp
}: {
  activeMission: any; flush?: boolean; onCodeChange?: (code: string) => void, onCollapse?: () => void, isInterview?: boolean, language?: string
}) {
  const { setDraft, getDraft } = useEditorStore();
  const [language, setLanguage] = useState(langProp || "cpp");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [showLangs, setShowLangs] = useState(false);

  useEffect(() => {
    if (langProp) setLanguage(langProp);
  }, [langProp]);

  useEffect(() => {
    async function fetchTemplate() {
      if (!activeMission) return;

      if (isInterview) {
        const sqlDraft = await getInterviewDraft(activeMission.id);
        if (sqlDraft) {
          setCode(sqlDraft);
          setLoading(false);
          return;
        }
      } else {
        const draft = getDraft(activeMission.id.toString(), language);
        if (draft) {
          setCode(draft);
          return;
        }
      }

      if (!activeMission.leetcode_url) {
        setCode(STARTER[language] ?? "// Write your solution here...\n");
        return;
      }

      setLoading(true);
      const snippet = await fetchLeetcodeTemplate(activeMission.leetcode_url, language);
      let finalCode = snippet || STARTER[language] || "// Write your solution here...\n";

      console.log('DEBUG: Finding JSON for ID:', activeMission.id, typeof activeMission.id);
      // Fallback: search JSON for more metadata
      let missionJson: any = null;
      for (const topic of (striversData.topics || [])) {
        const found = (topic.questions || []).find((q: any) => {
          const match = Number(q.id) === Number(activeMission.id);
          if (match) console.log('DEBUG: Match found for question:', q.name);
          return match;
        });
        if (found) { missionJson = found; break; }
      }
      if (!missionJson) console.log('DEBUG: No match found in striversData topics');
      const robustCppMain = activeMission.cpp_main || missionJson?.cpp_main;
      const robustTestCases = activeMission.test_cases || missionJson?.test_cases;
      console.log('DEBUG: robustCppMain length:', robustCppMain?.length || 0);

      // Use pre-defined cpp_main if available for C++
      if (language === 'cpp' && robustCppMain) {
        finalCode = robustCppMain;
      } else if (language === 'cpp' && !finalCode.includes('main()')) {
        const testCase = robustTestCases?.[0];
        // Extract method name (e.g., generate)
        const methodMatch = snippet?.match(/(\w+)\s*\(/);
        const methodName = methodMatch ? methodMatch[1] : "yourFunction";

        // Clean up input for comment (e.g., numRows = 5 -> 5)
        const inputVal = testCase?.input?.split('=')?.[1]?.trim() || "...";

        finalCode += `\n\nint main() {\n    Solution sol;\n    // Sample Test Case: ${testCase?.input || "N/A"}\n    // Calling the function:\n    // auto result = sol.${methodName}(${inputVal});\n    \n    return 0;\n}\n`;
      } else if (language === 'java' && !finalCode.includes('main(')) {
        const testCase = activeMission.test_cases?.[0];
        const methodMatch = snippet?.match(/(\w+)\s*\(/);
        const methodName = methodMatch ? methodMatch[1] : "yourFunction";
        const inputVal = testCase?.input?.split('=')?.[1]?.trim() || "...";

        finalCode += `\n\npublic class Main {\n    public static void main(String[] args) {\n        Solution sol = new Solution();\n        // Sample Test Case: ${testCase?.input || "N/A"}\n        // sol.${methodName}(${inputVal});\n    }\n}\n`;
      }

      setCode(finalCode);
      setDraft(activeMission.id.toString(), language, finalCode);
      setLoading(false);
    }
    fetchTemplate();
  }, [activeMission?.id, language]);

  const handleLangChange = (lang: string) => {
    setLanguage(lang);
  };

  // ── Debounced persistence to avoid DB hammering
  useEffect(() => {
    if (!activeMission || !code || loading) return;

    const timer = setTimeout(() => {
      if (isInterview) {
        saveInterviewDraft(activeMission.id, code);
      } else {
        setDraft(activeMission.id.toString(), language, code);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [code, activeMission?.id, language, isInterview, loading]);

  const handleReset = async () => {
    if (!confirm("Reset to default template? This will erase your code.")) return;
    setLoading(true);
    if (!activeMission?.leetcode_url) {
      setCode(STARTER[language] ?? "// Write your solution here...\n");
      setLoading(false);
      return;
    }
    const snippet = await fetchLeetcodeTemplate(activeMission.leetcode_url, language);
    let finalCode = snippet || STARTER[language] || "// Write your solution here...\n";

    // JSON fallback for robust metadata
    let missionJson: any = null;
    for (const topic of (striversData.topics || [])) {
      const found = (topic.questions || []).find((q: any) => Number(q.id) === Number(activeMission.id));
      if (found) { missionJson = found; break; }
    }
    const robustCppMain = activeMission.cpp_main || missionJson?.cpp_main;

    if (language === 'cpp' && robustCppMain) {
      finalCode = robustCppMain;
    }
    setCode(finalCode);
    setLoading(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRun = async () => {
    setRunning(true);
    setOutput("Executing remotely via Wadbox API...");
    const res = await executeCode(language, code);
    setRunning(false);

    if (res.error) {
      setOutput(`[ERROR]\n${res.error}`);
    } else {
      setOutput(res.output || "[SUCCESS] Execution completed. No output returned.");
    }
  };

  const { theme: appTheme, accentColor, editorDynamicTheme, setEditorDynamicTheme } = useEditorStore();
  const [monaco, setMonaco] = useState<any>(null);

  const handleEditorWillMount = (m: any) => {
    setMonaco(m);
  };

  useEffect(() => {
    if (!monaco) return;

    if (editorDynamicTheme) {
      const isLight = (color: string) => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 155;
      };

      const baseTheme = isLight(appTheme.bg) ? 'vs' : 'vs-dark';

      monaco.editor.defineTheme('qued-dynamic', {
        base: baseTheme,
        inherit: true,
        rules: [],
        colors: {
          'editor.background': appTheme.panel,
          'editor.foreground': appTheme.text,
          'editor.lineHighlightBackground': appTheme.hover + '44',
          'editorCursor.foreground': accentColor,
          'editor.selectionBackground': accentColor + '33',
          'editorIndentGuide.background': appTheme.border + '33',
          'editorLineNumber.foreground': appTheme.muted,
          'editorActiveLineNumber.foreground': accentColor,
        }
      });
      monaco.editor.setTheme('qued-dynamic');
    } else {
      monaco.editor.setTheme('vs-dark');
    }
  }, [appTheme, accentColor, editorDynamicTheme, monaco]);

  return (
    <div className={`flex-1 flex flex-col h-full w-full overflow-hidden ${flush ? "" : "border border-claude-border/50 rounded-xl bg-claude-panel shadow-sm"}`}>
      {/* Header */}
      <div style={{ height: '32px' }} className="flex items-center justify-between px-6 border-b border-claude-border/50 shrink-0 bg-claude-hover/10">
        <div className="flex items-center gap-6">
          <span className="text-[11px] font-bold uppercase tracking-widest text-claude-muted/70 flex items-center gap-2">
            Editor
            {loading && <Loader2 size={12} className="animate-spin text-claude-accent" />}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowLangs(!showLangs)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9.5px] font-mono transition-all duration-150 border bg-claude-bg border-claude-accent/20 text-claude-accent shadow-sm group`}
            >
              {language}
              <ChevronDown size={11} className={`transition-transform duration-200 ${showLangs ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showLangs && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full mt-2 left-0 w-32 bg-claude-panel border border-claude-border rounded-xl shadow-xl overflow-hidden z-[100]"
                >
                  <div className="py-1">
                    {LANGS.map(lang => (
                      <button
                        key={lang}
                        onClick={() => {
                          handleLangChange(lang);
                          setShowLangs(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-[11px] font-mono transition-colors hover:bg-claude-hover ${language === lang ? "bg-claude-hover/50 text-claude-accent" : "text-claude-muted hover:text-claude-text"
                          }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onCollapse && (
            <button
              onClick={onCollapse}
              title="Collapse editor"
              className="p-2 rounded-md text-claude-muted hover:text-claude-text hover:bg-claude-hover transition-colors"
            >
              <Minimize2 size={16} />
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1.5 rounded-md text-claude-muted hover:text-claude-text hover:bg-claude-hover transition-colors"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
          <button
            onClick={handleReset}
            title="Reset to template"
            className="p-1.5 rounded-md text-claude-muted hover:text-claude-text hover:bg-claude-hover transition-colors"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            title="Run code"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-claude-bg bg-green-500 hover:bg-green-400 transition-colors font-bold text-[10px] uppercase tracking-wider disabled:opacity-50 ml-1.5"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={10} className="fill-current" />}
            Run
          </button>

          <button
            onClick={() => setEditorDynamicTheme(!editorDynamicTheme)}
            title={editorDynamicTheme ? "Disable Dynamic Theme" : "Enable Dynamic Theme"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-widest transition-all ${editorDynamicTheme
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-claude-panel border-claude-border text-claude-muted"
              }`}
          >
            {editorDynamicTheme ? "Auto" : "Static"}
          </button>
        </div>
      </div>

      {/* Editor & Output Split */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Monaco editor */}
        <div className={`flex-1 p-0 min-h-0 ${output !== null ? 'border-b border-claude-border' : ''}`}>
          <Editor
            height="100%"
            language={language}
            theme="qued-dynamic"
            beforeMount={handleEditorWillMount}
            value={code}
            onChange={v => {
              const newCode = v ?? "";
              setCode(newCode);
              onCodeChange?.(newCode);
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13.5,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontLigatures: true,
              lineHeight: 22,
              padding: { top: 4, bottom: 4 },
              scrollBeyondLastLine: false,
              renderLineHighlight: "gutter",
              lineNumbers: "on",
              glyphMargin: false,
              folding: true,
              wordWrap: "on",
              tabSize: 2,
              cursorBlinking: "smooth",
              smoothScrolling: true,
              overviewRulerBorder: false,
              scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
            }}
          />
        </div>

        {/* Console Output */}
        {output !== null && (
          <div className="h-48 shrink-0 bg-claude-bg flex flex-col relative group border-t border-claude-border">
            <div className="flex items-center justify-between px-4 py-1.5 bg-claude-panel border-b border-claude-border">
              <span className="text-[10px] font-mono text-claude-muted flex items-center gap-2">
                <TerminalSquare size={12} />
                OUTPUT
              </span>
              <button onClick={() => setOutput(null)} className="text-[10px] text-claude-muted hover:text-red-400 uppercase tracking-wider">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className={`text-xs font-mono whitespace-pre-wrap ${output.startsWith("[ERROR]") ? "text-red-400" : "text-green-400/80"}`}>
                {output}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
