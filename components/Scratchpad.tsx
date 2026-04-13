"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Mic, MicOff, Loader2 } from "lucide-react";
import { getDb } from "../lib/db";
import { useEditorStore } from "../lib/store";

export default function Scratchpad({ date, activeMission }: { date: string; activeMission?: any }) {
  const { setNotes: setStoreNotes, getNotes: getStoreNotes } = useEditorStore();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser version. Use Chrome/Edge or ensure internet access.");
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.warn("Already started", e);
      }
    }
  };

  // 1. Sync from store or DB when mission/date changes
  useEffect(() => {
    async function initNotes() {
      if (activeMission?.id) {
        const stored = getStoreNotes(activeMission.id.toString());
        if (stored !== null) {
          setNotes(stored);
          return;
        }
      }

      // Fallback to legacy date-based DB notes
      if (!date) return;
      const db = await getDb();
      const res: any[] = await db.select("SELECT notes FROM daily_schedule WHERE date = $1", [date]);
      if (res.length > 0 && res[0].notes) {
        setNotes(res[0].notes);
        if (activeMission?.id) setStoreNotes(activeMission.id.toString(), res[0].notes);
      } else {
        setNotes("");
      }
    }
    initNotes();
  }, [activeMission?.id, date]);

  // 2. Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined" && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript + " ";
            }
          }
          if (currentTranscript) {
            setNotes(prev => prev + (prev.length > 0 ? " " : "") + currentTranscript);
            setStatus("unsaved");
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
          if (event.error === 'not-allowed') {
            alert("Microphone permission denied. Please allow it in system settings.");
          }
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  const persistNotes = async (text: string) => {
    setStatus("saving");

    // Save to persistent mission store
    if (activeMission?.id) {
      setStoreNotes(activeMission.id.toString(), text);
    }

    // Also sync to daily DB for legacy compatibility
    if (date) {
      const db = await getDb();
      await db.execute("UPDATE daily_schedule SET notes = $1 WHERE date = $2", [text, date]);
    }

    setStatus("saved");
  };

  const handleChange = (text: string) => {
    setNotes(text);
    setStatus("unsaved");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persistNotes(text), 800);
  };

  const handleClear = async () => {
    if (notes.trim() && !confirm("Clear all notes?")) return;
    handleChange("");
  };

  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const lineCount = notes ? notes.split("\n").length : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-claude-bg overflow-hidden">
      {/* Status bar */}
      <div style={{ height: '32px' }} className="flex items-center justify-between px-5 border-b border-claude-border shrink-0">
        <div className="flex items-center gap-3 text-[10px] text-claude-muted font-mono">
          <span>{wordCount}w</span>
          <span className="text-claude-border">·</span>
          <span>{lineCount}L</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRecording}
            title={isRecording ? "Stop recording" : "Voice to text"}
            className={`transition-all p-1.5 rounded-full flex items-center gap-2 group ${isRecording ? "bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "text-claude-muted hover:text-claude-accent hover:bg-claude-hover"
              }`}
          >
            {isRecording ? <div className="flex items-center gap-1.5 px-0.5"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> <MicOff size={13} /></div> : <Mic size={13} />}
          </button>
          <span className={`text-[10px] transition-colors ${status === "saved" ? "text-green-400/70" :
              status === "saving" ? "text-claude-accent/70" :
                "text-claude-muted"
            }`}>
            {status === "saved" ? "Saved" : status === "saving" ? "Saving..." : "Unsaved"}
          </span>
          <button
            onClick={handleClear}
            title="Clear notes"
            className="text-claude-muted hover:text-red-400 transition-colors p-1 rounded"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        className="flex-1 w-full px-6 py-5 bg-transparent text-claude-text resize-none focus:outline-none placeholder-claude-muted/20 leading-relaxed font-normal"
        style={{ fontFamily: "'Caveat', cursive", fontSize: '18px' }}
        placeholder={`Mission Notes\n\n// Approach:\n// Time complexity:\n// Edge cases:`}
        value={notes}
        onChange={e => handleChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
