"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { initDb, generateDailyMissions, getMissionDetails, markCompleted, resetDatabase, getProgressStats, getDb, getCurrentDayKey, hasUnfinishedDailyTasks } from "../lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { open } from "@tauri-apps/plugin-shell";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { check } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import {
  ListTodo, Code2, Settings, TerminalSquare, AlertCircle,
  Circle, CheckCircle2, Bot, Activity, ExternalLink, ChevronRight, ChevronLeft,
  Keyboard, Sun, Clock, Calendar, History, Monitor, Maximize2, Minimize2, Trophy,
  Archive, Coffee, X, Swords, User, Sparkles, ScrollText
} from "lucide-react";
import { format } from "date-fns";
import MissionEditor from "../components/MissionEditor";
import MissionChat from "../components/MissionChat";
import Scratchpad from "../components/Scratchpad";
import WeeklyTest from "../components/WeeklyTest";
import InterviewModule from "../components/InterviewModule";
import Inventory from "../components/Inventory";
import ChillZone from "../components/ChillZone";
import CombatArena from "../components/CombatArena";
import Auth from "../components/Auth";
import { useEditorStore } from "../lib/store";
import { Check } from "lucide-react";
import { supabase } from "../lib/supabase";

type View = "tasks" | "workspace" | "progress" | "missed" | "completed" | "settings" | "test" | "interview" | "inventory" | "duel";
type WorkspaceTab = "video" | "scratchpad";

const CHANGELOG = [
  {
    version: "1.0.1",
    title: "Version 1.0.1",
    date: "April 13, 2026",
    changes: [
      "In-App Updates: Automated distribution and installation system.",
      "Task Reminders: Periodic notifications for unfinished daily goals.",
      "Cloud Engine: Improved stability and error handling for AI providers.",
      "UI Refinement: Enhanced animations and cleaner message formatting.",
      "Proxy Bridge: Renamed internal fetch engine for better compatibility.",
      "Response Filtering: Automated removal of reasoning tags from assistant outputs."
    ]
  },
  {
    version: "0.1.0",
    title: "Version 0.1.0",
    date: "April 10, 2026",
    changes: [
      "Core DSA Mission tracking.",
      "Local AI integration via Ollama.",
      "A2Z SDE Sheet integration."
    ]
  }
];


function getYouTubeId(url: string) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]{11})/);
  return match ? match[1] : null;
}

function DifficultyPill({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    Easy: "text-green-400 bg-green-500/10 border-green-500/20",
    Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    Hard: "text-red-400 bg-red-500/10 border-red-500/20",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md border ${styles[difficulty] ?? "text-claude-muted border-claude-border"}`}>
      {difficulty}
    </span>
  );
}

function CircleProgress({ solved, total }: { solved: number; total: number }) {
  const pct = total > 0 ? solved / total : 0;
  const r = 60;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" className="rotate-[-90deg]">
      <circle cx="80" cy="80" r={r} fill="none" stroke="#222222" strokeWidth="6" />
      <circle
        cx="80" cy="80" r={r} fill="none"
        stroke="#da7756" strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.5s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
    </svg>
  );
}

function StatBar({ label, solved, total, color }: { label: string; solved: number; total: number; color: string }) {
  const pct = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div className="w-full translate-x-[-6px] translate-y-[-15px]">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="font-bold uppercase tracking-widest opacity-60" style={{ color }}>{label}</span>
        <span className="text-claude-muted font-mono font-medium">{solved} / {total}</span>
      </div>
      <div className="h-2 bg-claude-hover rounded-full overflow-hidden border border-claude-border/10">
        <motion.div
          className="h-full rounded-full shadow-sm"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function TopicBar({ label, solved, total }: { label: string; solved: number; total: number }) {
  const pct = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center text-[11px] mb-2 px-0.5">
        <span className="font-bold uppercase tracking-widest text-claude-muted/70 truncate mr-2" title={label}>{label}</span>
        <span className="text-claude-muted/40 font-mono">{solved}/{total}</span>
      </div>
      <div className="h-[6px] bg-claude-border/20 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-claude-accent/60 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function SystemThemeRoot() {
  const { theme, accentColor, fontFamily } = useEditorStore();

  const fontStack = fontFamily === 'Inter'
    ? "'Inter', system-ui, -apple-system, sans-serif"
    : `'${fontFamily}', system-ui, sans-serif`;

  return (
    <style dangerouslySetInnerHTML={{
      __html: `
      :root {
        --claude-accent: ${accentColor};
        --color-claude-accent: ${accentColor};
        --background: ${theme.bg};
        --foreground: ${theme.text};
        --color-claude-bg: ${theme.bg};
        --color-claude-panel: ${theme.panel};
        --color-claude-hover: ${theme.hover};
        --color-claude-border: ${theme.border};
        --color-claude-text: ${theme.text};
        --color-claude-muted: ${theme.muted};
      }
      *:not([data-no-theme="true"]) {
        font-family: ${fontStack} !important;
      }
      body {
        font-family: ${fontStack} !important;
        background-color: ${theme.bg} !important;
        color: ${theme.text} !important;
      }
      .text-claude-accent { color: ${accentColor} !important; }
      .bg-claude-accent { background-color: ${accentColor} !important; }
      .border-claude-accent { border-color: ${accentColor} !important; }
      .selection\\:bg-claude-accent\\/30::selection { background-color: ${accentColor}4d !important; }
    `}} />
  );
}

const THEME_PROFILES = [
  {
    id: "obsidian",
    name: "Obsidian Carbon",
    colors: { bg: "#1c1c1a", panel: "#272725", hover: "#353533", border: "#3b3b38", text: "#e6e4d9", muted: "#a3a198" }
  },
  {
    id: "abyss",
    name: "System Abyss",
    colors: { bg: "#080808", panel: "#121212", hover: "#1a1a1a", border: "#222222", text: "#ffffff", muted: "#666666" }
  },
  {
    id: "nordic",
    name: "Nordic Protocol",
    colors: { bg: "#0f172a", panel: "#1e293b", hover: "#334155", border: "#475569", text: "#f8fafc", muted: "#94a3b8" }
  },
  {
    id: "toxxic",
    name: "Toxxic Laboratory",
    colors: { bg: "#051105", panel: "#0a1a0a", hover: "#142814", border: "#1e3c1e", text: "#d1ffd1", muted: "#4e9e4e" }
  },
  {
    id: "ghost",
    name: "Dark White",
    colors: { bg: "#c6c6c1", panel: "#d1d1cc", hover: "#b8b8b2", border: "#a8a8a2", text: "#0a0a09", muted: "#4a4a47" }
  },
  {
    id: "light",
    name: "System Laboratory",
    colors: { bg: "#f5f5f0", panel: "#ffffff", hover: "#ebebe6", border: "#e0e0da", text: "#1c1c1a", muted: "#7a7a75" }
  }
];

function CustomizationPane() {
  const accentColor = useEditorStore(state => state.accentColor);
  const fontFamily = useEditorStore(state => state.fontFamily);
  const currentTheme = useEditorStore(state => state.theme);
  const setAccentColor = useEditorStore(state => state.setAccentColor);
  const setFontFamily = useEditorStore(state => state.setFontFamily);
  const setTheme = useEditorStore(state => state.setTheme);

  return (
    <motion.div
      key="customization"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-10 pb-20"
    >
      <div>
        <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2">System Aesthetics</h3>
        <p className="text-xs text-claude-muted mb-8 italic">Calibrate the environmental parameters of your interface.</p>

        <div className="space-y-12">
          {/* Environment Section */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-accent flex items-center gap-2">
              <Sparkles size={12} /> Environment Profiles
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {THEME_PROFILES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.colors)}
                  className={`p-5 rounded-3xl border transition-all relative overflow-hidden group ${currentTheme.bg === t.colors.bg
                    ? "border-claude-accent ring-1 ring-claude-accent/30 shadow-xl scale-[1.02]"
                    : "border-claude-border hover:border-claude-muted bg-claude-panel/20"
                    }`}
                  style={{ backgroundColor: t.colors.bg }}
                >
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest" style={{ color: t.colors.text }}>{t.name}</div>
                      <div className="text-[9px] font-bold opacity-40 uppercase tracking-tighter" style={{ color: t.colors.text }}>Base: {t.colors.bg}</div>
                    </div>
                    {currentTheme.bg === t.colors.bg && <div className="w-6 h-6 rounded-full bg-claude-accent flex items-center justify-center shadow-lg"><Check size={14} className="text-white" /></div>}
                  </div>
                  <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent opacity-10 group-hover:opacity-20 transition-opacity" />
                </button>
              ))}
            </div>
          </section>

          {/* Accent Color Section */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-accent flex items-center gap-2">
              <Activity size={12} /> Plasma Accent Palette
            </h4>
            <div className="flex flex-wrap gap-4">
              {[
                { name: "Midnight Rust", color: "#da7756" },
                { name: "Voltage Lime", color: "#c8f135" },
                { name: "Cyber Cyan", color: "#00f2ff" },
                { name: "Electric Violet", color: "#bc13fe" },
                { name: "Thermal Red", color: "#ff4b2b" },
                { name: "Pure Silver", color: "#ffffff" },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => setAccentColor(c.color)}
                  className={`group relative w-12 h-12 rounded-2xl transition-all duration-300 ${accentColor === c.color ? 'scale-110 shadow-lg' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                  title={c.name}
                >
                  <div
                    className="absolute inset-0 rounded-2xl border-2 transition-all"
                    style={{
                      backgroundColor: c.color,
                      borderColor: accentColor === c.color ? 'white' : 'transparent'
                    }}
                  />
                  {accentColor === c.color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check size={20} className="text-black stroke-[3px]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Typography Section */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-claude-accent flex items-center gap-2">
              <Keyboard size={12} /> Typography Engine
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "Syne", label: "Syne (Modern)", desc: "Aggressive & Industrial" },
                { id: "Inter", label: "Inter (System)", desc: "Neutral & Legible" },
                { id: "JetBrains Mono", label: "JetBrains (Technical)", desc: "Optimized for Code" },
                { id: "Caveat", label: "Caveat (Handwritten)", desc: "Informal Scribbles" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontFamily(f.id)}
                  className={`p-4 rounded-2xl border text-left transition-all ${fontFamily === f.id
                    ? "bg-claude-accent/10 border-claude-accent shadow-sm"
                    : "bg-claude-panel/30 border-claude-border hover:border-claude-muted opacity-60 hover:opacity-100"
                    }`}
                >
                  <div data-no-theme="true" className="text-sm font-bold text-white mb-1" style={{ fontFamily: f.id }}>{f.label}</div>
                  <div className="text-[10px] text-claude-muted uppercase tracking-widest">{f.desc}</div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}


export default function App() {
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<any[]>([]);
  const [leftWidth, setLeftWidth] = useState(400);
  const [rightWidth, setRightWidth] = useState(380);
  const [walkthroughHeight, setWalkthroughHeight] = useState(300);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingWalkthrough, setIsResizingWalkthrough] = useState(false);
  const [activeMission, setActiveMission] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [stats, setStats] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>("tasks");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("video");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [completedDays, setCompletedDays] = useState<any[]>([]);
  const [missedDays, setMissedDays] = useState<any[]>([]);
  const [showExamToast, setShowExamToast] = useState(false);
  const [lastNotifiedDay, setLastNotifiedDay] = useState<number | null>(null);

  // Chill Zone State
  const [chillZoneActive, setChillZoneActive] = useState(false);
  const [chillTimeLeft, setChillTimeLeft] = useState(0); // in ms
  const [showChillUnlockToast, setShowChillUnlockToast] = useState(false);

  // Provider State (Cloud vs Local)
  const [apiProvider, setApiProvider] = useState<"ollama" | "ollama_cloud" | "openrouter" | "groq">(
    (typeof window !== 'undefined' ? localStorage.getItem("provider") as any : null) || "ollama"
  );
  const [externalApiKey, setExternalApiKey] = useState(
    (typeof window !== 'undefined' ? localStorage.getItem("api_key") : "") || ""
  );
  const [externalModel, setExternalModel] = useState(
    (typeof window !== 'undefined' ? localStorage.getItem("model") : "") || ""
  );
  const [externalBaseUrl, setExternalBaseUrl] = useState(
    (typeof window !== 'undefined' ? localStorage.getItem("base_url") : "") || ""
  );
  const [settingsTab, setSettingsTab] = useState<"general" | "process" | "danger" | "profile" | "customization" | "feedback" | "admin" | "changelog">("profile");
  const [localUser, setLocalUser] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [rotationPillCollapsed, setRotationPillCollapsed] = useState(false);

  // Feedback State
  const [feedbackInput, setFeedbackInput] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);

  const submitFeedback = async () => {
    if (!feedbackInput.trim()) return;
    setSendingFeedback(true);
    const { error } = await supabase
      .from('feedback')
      .insert([{
        user_id: localUser?.id,
        user_name: localUser?.name,
        content: feedbackInput
      }]);
    setSendingFeedback(false);
    if (!error) {
      setFeedbackInput("");
      alert("Feedback received. Thank you for helping refine Qued.");
    } else {
      alert("Failed to ship feedback: " + error.message);
    }
  };

  const fetchFeedbackList = useCallback(async () => {
    if (localUser?.role !== "Admin Observer") return;
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setFeedbackList(data);
    }
  }, [localUser]);

  useEffect(() => {
    if (settingsTab === "admin") {
      fetchFeedbackList();
    }
  }, [settingsTab, fetchFeedbackList]);
  const profilePic = useEditorStore(state => state.profilePic);
  const setProfilePic = useEditorStore(state => state.setProfilePic);

  const handleExitChill = useCallback(() => {
    setChillZoneActive(false);
  }, []);

  useEffect(() => {
    // Load User Identity
    let id = localStorage.getItem("qued_user_id");
    let name = localStorage.getItem("qued_user_name");
    let role = localStorage.getItem("qued_user_role");
    if (id && name) {
      setLocalUser({ id, name, role: role || "Authorized User" });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("qued_user_id");
    localStorage.removeItem("qued_user_name");
    localStorage.removeItem("qued_user_role");
    setLocalUser(null);
    window.location.reload(); // Re-initialize store for guest
  };

  const dayNumber = stats?.days_elapsed ?? null;
  const allDone = schedule?.q1_completed === 1 && schedule?.q2_completed === 1;
  const q1Done = schedule?.q1_completed === 1;
  const q2Done = schedule?.q2_completed === 1;

  const requestRef = useRef<number | null>(null);

  const refreshUI = useCallback(async () => {
    try {
      const db = await getDb();

      // Mission Archive (all entries with progress)
      const c: any[] = await db.select(
        `SELECT d.*, m1.name as q1_name, m1.difficulty as q1_diff, m2.name as q2_name, m2.difficulty as q2_diff
           FROM daily_schedule d
           JOIN missions m1 ON d.q1_id = m1.id
           JOIN missions m2 ON d.q2_id = m2.id
           WHERE (d.q1_completed = 1 OR d.q2_completed = 1)
           ORDER BY d.date DESC`
      );
      setCompletedDays(c);

      // Missed Missions (past entries + today's gaps)
      const todayStr = getCurrentDayKey();
      const m: any[] = await db.select(
        `SELECT d.*, m1.name as q1_name, m1.difficulty as q1_diff, m2.name as q2_name, m2.difficulty as q2_diff
           FROM daily_schedule d
           JOIN missions m1 ON d.q1_id = m1.id
           JOIN missions m2 ON d.q2_id = m2.id
           WHERE (d.date < $1 OR (d.date = $1 AND (d.q1_completed = 0 OR d.q2_completed = 0))) AND (d.q1_completed = 0 OR d.q2_completed = 0)
           ORDER BY d.date DESC`, [todayStr]
      );
      setMissedDays(m);
      setStats(await getProgressStats());
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(60, Math.min(window.innerWidth - 200, e.clientX - 64));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(60, Math.min(window.innerWidth - 200, window.innerWidth - e.clientX));
        setRightWidth(newWidth);
      }
      if (isResizingWalkthrough) {
        const newHeight = Math.max(150, Math.min(600, e.clientY - 120));
        setWalkthroughHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
      setIsResizingWalkthrough(false);
    };
    if (isResizingLeft || isResizingRight || isResizingWalkthrough) {
      document.body.style.cursor = isResizingWalkthrough ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight, isResizingWalkthrough]);

  useEffect(() => {
    const initPlugins = async () => {
      // 1. Permissions
      let permission = await isPermissionGranted();
      if (!permission) {
        permission = await requestPermission() === 'granted';
      }

      // 2. Automated Update Check (One-Click)
      try {
        const update = await check();
        if (update) {
          const yes = await ask(`A new version (${update.version}) is available. Would you like to install it now?`, { 
            title: 'Update Available', 
            kind: 'info' 
          });
          if (yes) {
            await update.downloadAndInstall();
            // App will restart automatically if successful
          }
        }
      } catch (e) {
        console.warn("[UPDATER] Update check skipped (development mode or no network).");
      }
    };
    
    if (typeof window !== 'undefined') {
      initPlugins();
    }

    // ── 3-Hour Notification Loop
    const interval = setInterval(async () => {
      const unfinished = await hasUnfinishedDailyTasks();
      if (unfinished) {
        const hasPerm = await isPermissionGranted();
        if (hasPerm) {
          sendNotification({
            title: 'Qued: Mission Reminder',
            body: "The day is half over! You still have unfinished SDE tasks. Let's conquer them.",
          });
        }
      }
    }, 1000 * 60 * 60 * 3); // 3-hour interval

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        await initDb();
        const daily = await generateDailyMissions();
        if (daily) {
          setSchedule(daily);
          const [q1, q2] = await Promise.all([
            getMissionDetails(daily.q1_id),
            getMissionDetails(daily.q2_id),
          ]);
          setMissions([q1, q2]);
          setActiveMission(q1);
        }
        await refreshUI();
      } catch (e) {
        console.error("Load failed:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [localUser?.id, refreshUI]);

  // Daily Mission Rotation & Midnight Sync
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const remaining = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
      setTimeLeft(remaining);

      // Sync check: if we just crossed midnight (remaining is near 86400)
      if (remaining > 86395) {
        const daily = await generateDailyMissions();
        if (daily) {
          setSchedule(daily);
          const [q1, q2] = await Promise.all([
            getMissionDetails(daily.q1_id),
            getMissionDetails(daily.q2_id),
          ]);
          setMissions([q1, q2]);
          const s = await getProgressStats();
          setStats(s);
          if (s.days_elapsed > 0 && s.days_elapsed % 7 === 0 && s.days_elapsed !== lastNotifiedDay) {
            setShowExamToast(true);
            setLastNotifiedDay(s.days_elapsed);
          }
          await refreshUI();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshUI, lastNotifiedDay]);

  // Chill Zone Unlock Logic
  useEffect(() => {
    if (allDone) {
      const checkChillStatus = async () => {
        const unlockedAt = localStorage.getItem("chill_zone_unlocked_at");
        const todayKey = schedule?.date || "today";
        const storedDay = localStorage.getItem("chill_zone_day");

        let startTime: number;
        if (storedDay !== todayKey || !unlockedAt) {
          startTime = Date.now();
          localStorage.setItem("chill_zone_unlocked_at", startTime.toString());
          localStorage.setItem("chill_zone_day", todayKey);
          setShowChillUnlockToast(true);
        } else {
          startTime = parseInt(unlockedAt);
        }

        const elapsed = Date.now() - startTime;
        const remaining = (15 * 60 * 1000) - elapsed;

        if (remaining > 0) {
          setChillTimeLeft(remaining);
        } else {
          setChillTimeLeft(0);
        }
      };
      checkChillStatus();
    }
  }, [allDone, schedule?.date]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") { e.preventDefault(); setCurrentView("tasks"); }
        if (e.key === "2") { e.preventDefault(); setCurrentView("workspace"); }
        if (e.key === "3") { e.preventDefault(); setCurrentView("progress"); }
        if (e.key === "4") { e.preventDefault(); setCurrentView("test"); }
        if (e.key === "5") { e.preventDefault(); setCurrentView("duel"); }
        if (e.key === ",") { e.preventDefault(); setCurrentView("settings"); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "?") {
        e.preventDefault();
        setShowShortcuts(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleMission = useCallback(async (missionId: number) => {
    if (!schedule) return;
    const isQ1 = missions[0]?.id === missionId;
    const ns = { ...schedule };
    if (isQ1) ns.q1_completed = ns.q1_completed === 1 ? 0 : 1;
    else ns.q2_completed = ns.q2_completed === 1 ? 0 : 1;
    setSchedule(ns);
    await markCompleted(schedule.date, ns.q1_completed === 1, ns.q2_completed === 1);
    await refreshUI();
  }, [schedule, missions, refreshUI]);

  const openMissionInWorkspace = (m: any) => {
    setActiveMission(m);
    setCurrentView("workspace");
    setWorkspaceTab("video");
  };

  const handleHardReset = async () => {
    if (confirm("Reset all progress? This will permanently purge your history, chat, and notes.")) {
      await resetDatabase();
      useEditorStore.getState().clearStore();
      localStorage.removeItem("drafts");
      localStorage.removeItem("qued_user_id");
      localStorage.removeItem("qued_user_name");
      localStorage.removeItem("qued_user_role");
      localStorage.removeItem("chill_zone_unlocked_at");
      localStorage.removeItem("chill_zone_day");
      window.location.reload();
    }
  };

  const handleCloudPurge = async () => {
    if (!localUser) return;
    if (confirm("DESTRUCTIVE ACTION: Permanent removal of your cloud registration. This clears your identity from the Qued registry. You will be logged out immediately. Proceed?")) {
      const { error } = await supabase
        .from('users_registry')
        .delete()
        .eq('id', localUser.id);

      if (error) {
        alert("Severance failed: " + error.message);
      } else {
        useEditorStore.getState().clearStore();
        localStorage.removeItem("qued_user_id");
        localStorage.removeItem("qued_user_name");
        localStorage.removeItem("qued_user_role");
        setLocalUser(null);
        window.location.reload();
      }
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 animate-pulse">Initializing System</span>
      </div>
    </div>
  );

  if (!localUser) {
    return <Auth onAuth={(u) => { setLocalUser(u); window.location.reload(); }} />;
  }

  return (
    <div className="flex h-screen bg-claude-bg text-claude-text font-sans overflow-hidden select-none relative">
      <SystemThemeRoot />
      {/* Moved rotation pill to inside main content area below */}

      {/* ── EXAM NOTIFICATION TOAST ────────────────────────── */}
      <AnimatePresence>
        {showExamToast && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-8 left-16 right-0 z-[100000] flex justify-center pointer-events-none"
          >
            <div className="pointer-events-auto bg-claude-accent border border-claude-accent/30 text-white px-6 py-4 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl flex items-center gap-5 min-w-[420px] border-b-4 border-b-black/10">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 shadow-inner">
                <Trophy size={24} strokeWidth={2.5} className="drop-shadow-md" />
              </div>
              <div className="flex-1">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] leading-none mb-2 text-white/90">Weekly Milestone Reached</h4>
                <p className="text-sm font-semibold tracking-tight text-white leading-tight">Review for Week {Math.floor((stats?.days_elapsed || 7) / 7)} is live.</p>
              </div>
              <button
                onClick={() => { setCurrentView("test"); setShowExamToast(false); }}
                className="px-5 py-2.5 bg-white text-claude-accent text-[11px] font-black uppercase tracking-[0.1em] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Enter Exam
              </button>
              <button
                onClick={() => setShowExamToast(false)}
                className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <AlertCircle size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="w-16 h-full border-r border-claude-border bg-claude-panel flex flex-col items-center py-5 shrink-0 z-20 rounded-r-2xl overflow-hidden shadow-xl">
        <div className="mb-10 flex flex-col items-center gap-1">
          {dayNumber && <span className="text-[10px] text-claude-muted/60 font-bold font-mono tracking-widest bg-claude-hover px-2 py-1 rounded-md mb-2">D{dayNumber}</span>}
        </div>

        <div className="flex flex-col gap-1 items-center w-full flex-1 translate-y-[-13px]">
          {([
            { id: "tasks", icon: ListTodo, title: "Tasks  ⌘1" },
            { id: "workspace", icon: Code2, title: "Workspace  ⌘2" },
            { id: "progress", icon: Activity, title: "Progress  ⌘3" },
            ...(stats?.days_elapsed > 0 && stats?.days_elapsed % 7 === 0 ? [{ id: "test", icon: Trophy, title: "EXAM MODE ACTIVE  ⌘4" } as any] : []),
            { id: "missed", icon: Calendar, title: "Missed" },
            { id: "completed", icon: History, title: "History" },
            { id: "interview", icon: Bot, title: "Mock Interview" },
            { id: "duel", icon: Swords, title: "Arena (IN DEV)" },
            { id: "inventory", icon: Archive, title: "Inventory" },
          ] as { id: View; icon: any; title: string }[]).map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              onClick={() => setCurrentView(id)}
              title={title}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border ${currentView === id
                ? "bg-claude-hover border-claude-accent/40 text-claude-accent shadow-sm"
                : "border-transparent text-claude-muted hover:text-claude-text hover:bg-claude-hover/30"
                }`}
            >
              <Icon size={19} strokeWidth={1.5} />
              {currentView === id && (
                <motion.div layoutId="nav-active" className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-px h-6 bg-claude-accent rounded-r-full shadow-[0_0_10px_rgba(218,119,86,0.4)]" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1">
          {chillTimeLeft > 0 && (
            <button
              onClick={() => setChillZoneActive(true)}
              title="Enter Chill Zone"
              className="group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white shadow-lg mb-2 overflow-hidden"
            >
              <Coffee size={18} strokeWidth={2} />
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ y: "100%" }}
                animate={{ y: `${100 - (chillTimeLeft / (30 * 60 * 1000) * 100)}%` }}
                transition={{ ease: "linear" }}
              />
            </button>
          )}

          <button
            onClick={() => setCurrentView("settings")}
            title="Settings  ⌘,"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all overflow-hidden border shadow-inner ${currentView === "settings" ? "bg-claude-hover border-claude-accent/40 text-claude-accent" : "border-transparent text-claude-muted hover:text-claude-text hover:bg-claude-hover/50"
              }`}
          >
            {useEditorStore.getState().profilePic ? (
              <img
                src={useEditorStore.getState().profilePic!}
                className="w-full h-full object-cover"
                alt="Profile"
              />
            ) : (
              <Settings size={18} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      <main className="flex-1 h-full overflow-hidden relative p-0 bg-claude-bg flex flex-col">
        {/* ── DAILY ROTATION PILL (ABSOLUTE TOP-CENTER OF MAIN) ────── */}
        <motion.div
          onClick={() => setRotationPillCollapsed(!rotationPillCollapsed)}
          initial={false}
          animate={{
            y: rotationPillCollapsed ? -20 : 0,
            opacity: rotationPillCollapsed ? 0.5 : 1
          }}
          whileHover={{ y: 0, opacity: 1 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[26px] px-7 bg-claude-panel border-l border-r border-b border-claude-border border-b-claude-accent/20 flex items-center gap-5 z-[10000] cursor-pointer rounded-b-2xl shadow-2xl backdrop-blur-md group transition-all"
        >
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-black uppercase text-claude-muted/70 tracking-[0.2em] group-hover:text-claude-accent transition-colors">
              {rotationPillCollapsed ? <Clock size={12} className="animate-pulse text-claude-accent" /> : "Next Rotation:"}
            </span>
            {!rotationPillCollapsed && (
              <span className="text-[12px] font-mono font-black text-claude-accent min-w-[70px] text-center tracking-tighter">
                {Math.floor(timeLeft / 3600)}h {Math.floor((timeLeft % 3600) / 60)}m
              </span>
            )}
          </div>
        </motion.div>
        <AnimatePresence mode="wait">

          {currentView === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="w-full h-full overflow-y-auto bg-claude-panel border border-claude-border/50 rounded-2xl shadow-sm"
            >
              <div className="min-h-full w-full flex flex-col items-center justify-center p-4 py-8">
                <div className="w-full max-w-2xl">
                  <div className="flex flex-col items-center text-center mb-12 translate-y-[-2px]">
                    <div className="mb-4">
                      <p className="text-[10px] text-claude-muted mb-2 tracking-[0.25em] flex items-center justify-center gap-2 uppercase font-bold">
                        <Clock size={12} />
                        {schedule?.date ?? "Today"}
                      </p>
                      <h1 className="text-4xl font-semibold tracking-tight translate-y-[-2px]">Today's Missions</h1>
                      {stats?.days_elapsed > 0 && stats?.days_elapsed % 7 === 0 && (
                        <button
                          onClick={() => setCurrentView("test")}
                          className="text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-2 bg-claude-accent text-white rounded-full shadow-[0_0_15px_rgba(218,119,86,0.3)] hover:scale-105 transition-all flex items-center gap-2 mb-6"
                        >
                          <Trophy size={11} strokeWidth={2.5} /> WEEK {Math.floor(stats.days_elapsed / 7)} EXAM ACTIVE
                        </button>
                      )}
                    </div>
                    {allDone ? (
                      <span className="text-green-400 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
                        ✓ All Objectives Met
                      </span>
                    ) : (
                      <span className="text-claude-muted text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 bg-claude-hover rounded-full">
                        {(q1Done ? 1 : 0) + (q2Done ? 1 : 0)} / 2 Tasks Completed
                      </span>
                    )}

                  </div>

                  <div className="flex flex-col gap-4 mb-8">
                    {missions.map((m, idx) => {
                      const done = idx === 0 ? q1Done : q2Done;
                      return (
                        <motion.div
                          key={idx}
                          layout
                          className={`group relative border rounded-xl transition-all duration-200 cursor-pointer overflow-hidden ${done ? "border-claude-border bg-claude-panel/40 opacity-60" : "border-claude-border bg-claude-panel hover:border-claude-muted shadow-sm hover:shadow-md"
                            }`}
                          onClick={() => openMissionInWorkspace(m)}
                        >
                          <div className={`absolute left-0 inset-y-0 w-px transition-colors duration-200 ${done ? "bg-green-500" : "bg-claude-accent opacity-0 group-hover:opacity-100"}`} />
                          <div className="px-6 py-5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] font-bold text-claude-accent bg-claude-accent/10 px-2.5 py-0.5 rounded border border-claude-accent/20 uppercase tracking-widest">
                                  {m.topic}
                                </span>
                                <DifficultyPill difficulty={m.difficulty} />
                              </div>
                              <button onClick={e => { e.stopPropagation(); toggleMission(m.id); }} className={`transition-colors shrink-0 ${done ? "text-green-400" : "text-claude-border hover:text-claude-muted"}`}>
                                {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                              </button>
                            </div>
                            <h2 className={`text-lg font-medium leading-tight mb-2 text-left ${done ? "line-through text-claude-muted" : "text-claude-text"}`}>
                              {m.name}
                            </h2>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-claude-muted opacity-60 font-mono">
                                {m.constraints?.length || 0} constraint{m.constraints?.length !== 1 ? "s" : ""}
                              </span>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={e => { e.stopPropagation(); open(m.leetcode_url); }} className="text-[9px] text-claude-muted hover:text-claude-accent flex items-center gap-1 transition-colors uppercase tracking-widest font-bold">
                                  <ExternalLink size={10} /> LeetCode
                                </button>
                                <span className="text-[10px] text-claude-muted flex items-center gap-1 opacity-40">Open workspace <ChevronRight size={10} /></span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === "progress" && stats && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 overflow-y-auto"
            >
              <div className="min-h-full w-full flex flex-col items-center justify-start p-12 py-6">
                <div className="w-full max-w-4xl">
                  <div className="text-center mb-6">
                    <h1 className="text-4xl font-semibold tracking-tight mb-1">DSA Progress</h1>
                    <p className="text-[11px] text-claude-muted font-bold uppercase tracking-[0.3em]">Algorithmic knowledge base expansion.</p>
                  </div>

                  <div className="w-full bg-claude-panel border border-claude-border rounded-2xl p-6 shadow-lg mb-8 overflow-hidden">
                    <div className="flex items-center gap-10">
                      <div className="relative shrink-0 scale-90">
                        <CircleProgress solved={stats.solved} total={stats.total} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center translate-y-[2px]">
                          <span className="text-3xl font-bold text-claude-text">{stats.solved}</span>
                          <span className="text-[9px] text-claude-muted uppercase tracking-[0.2em] font-bold">SOLVED</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-8 pb-4 border-b border-claude-border/50">
                          <div>
                            <p className="text-3xl font-bold tracking-tight">{stats.total}</p>
                            <p className="text-[9px] text-claude-muted uppercase tracking-widest font-bold">Total Nodes</p>
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-claude-accent tracking-widest">
                              {stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0}%
                            </p>
                            <p className="text-[9px] text-claude-muted uppercase tracking-widest font-bold">Completion</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-4">
                          <StatBar label="Easy" solved={stats.easy.solved} total={stats.easy.total} color="#4ade80" />
                          <StatBar label="Medium" solved={stats.medium.solved} total={stats.medium.total} color="#facc15" />
                          <StatBar label="Hard" solved={stats.hard.solved} total={stats.hard.total} color="#f87171" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10">
                    <h2 className="text-xl font-bold mb-6 text-center uppercase tracking-[0.2em] text-claude-muted/50">Sub-Domain Mastery</h2>
                    <div className="grid grid-cols-4 gap-x-8 gap-y-6 px-2 mb-16">
                      {(stats.topics || []).map((topic: any) => (
                        <TopicBar
                          key={topic.name}
                          label={topic.name}
                          solved={topic.solved}
                          total={topic.total}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === 'missed' && (
            <motion.div
              key="missed"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 overflow-y-auto flex flex-col items-center p-12 py-12"
            >
              <div className="max-w-4xl w-full">
                <div className="mb-8 text-center">
                  <h1 className="text-4xl font-semibold tracking-tight mb-1">Missed Days</h1>
                  <p className="text-xs font-bold text-claude-muted uppercase tracking-[0.3em]">Catch up on your roadmap.</p>
                </div>

                {missedDays.length === 0 ? (
                  <div className="bg-claude-panel border border-claude-border rounded-[2rem] p-12 text-center shadow-lg">
                    <p className="text-claude-muted text-sm font-medium">Consistent as ever! No missed missions detected.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {missedDays.map((day) => (
                      <div key={day.date} className="bg-claude-panel border border-claude-border rounded-xl p-4 shadow-lg relative transition-all hover:border-claude-accent/30 overflow-hidden">
                        <div className="flex items-center justify-between mb-2 border-b border-claude-border/30 pb-2 px-2 text-claude-text">
                          <div>
                            <h3 className="text-base font-bold text-claude-text leading-tight">{day.date.includes("test") ? format(new Date(parseInt(day.date.split("-").pop() || "0") * 30000), "MMM do, h:mm a") : format(new Date(day.date), "MMMM do, yyyy")}</h3>
                            <p className="text-[9px] text-claude-muted font-bold uppercase tracking-widest leading-none">Pending Missions</p>
                          </div>
                          <button
                            onClick={async () => {
                              const db = await getDb();
                              const m1Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q1_id]) as any[];
                              const m2Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q2_id]) as any[];
                              if (m1Res.length && m2Res.length) {
                                setMissions([m1Res[0], m2Res[0]]);
                                setActiveMission(m1Res[0]);
                                setCurrentView('workspace');
                              }
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-claude-accent hover:text-white transition-colors flex items-center gap-2 group"
                          >
                            RESUME MISSION <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: day.q1_id, name: day.q1_name, diff: day.q1_diff, done: day.q1_completed },
                            { id: day.q2_id, name: day.q2_name, diff: day.q2_diff, done: day.q2_completed }
                          ].map((q, qidx) => {
                            if (q.done) return null;
                            return (
                              <div key={q.id} className="flex flex-col gap-4 p-5 rounded-xl bg-red-400/5 border border-red-500/10 group/q relative overflow-hidden transition-all hover:bg-red-400/10 active:scale-[0.98]">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-[0.25em] opacity-60">Protocol {qidx + 1}</span>
                                  <h4 className="text-lg font-semibold text-claude-text leading-tight">{q.name}</h4>
                                  <div className="mt-2 flex items-center gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-red-400/40 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.4)]" />
                                    <span className="text-[10px] text-red-300 font-mono tracking-widest opacity-50 uppercase">{q.diff}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                  <button
                                    onClick={async () => {
                                      const db = await getDb();
                                      const m1Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q1_id]) as any[];
                                      const m2Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q2_id]) as any[];
                                      setMissions([m1Res[0], m2Res[0]]);
                                      setActiveMission(qidx === 0 ? m1Res[0] : m2Res[0]);
                                      setCurrentView('workspace');
                                    }}
                                    className="text-[10px] text-claude-accent hover:text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all hover:gap-3"
                                  >
                                    <Code2 size={12} /> Workspace
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const db = await getDb();
                                      const m = await db.select("SELECT leetcode_url FROM missions WHERE id = $1", [q.id]) as any[];
                                      if (m[0]?.leetcode_url) open(m[0].leetcode_url);
                                    }}
                                    className="text-[10px] text-claude-muted hover:text-claude-accent font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all"
                                  >
                                    <ExternalLink size={12} /> LeetCode
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 overflow-y-auto flex flex-col items-center p-12 py-12"
            >
              <div className="max-w-4xl w-full">
                <div className="mb-8 text-center">
                  <h1 className="text-4xl font-semibold tracking-tight mb-1">Mission Archive</h1>
                  <p className="text-xs font-bold text-claude-muted uppercase tracking-[0.3em]">Revisit your milestones.</p>
                </div>

                {completedDays.length === 0 ? (
                  <div className="bg-claude-panel border border-claude-border rounded-[2rem] p-12 text-center shadow-lg">
                    <p className="text-claude-muted text-sm font-medium">Your archive is empty. Finish your daily missions to see them here.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {completedDays.map((day) => (
                      <div key={day.date} className="bg-claude-panel border border-claude-border rounded-xl p-4 shadow-lg relative transition-all hover:border-claude-accent/30 overflow-hidden">
                        <div className="flex items-center justify-between mb-2 border-b border-claude-border/30 pb-2 px-2 text-claude-text">
                          <div>
                            <h3 className="text-lg font-bold text-claude-text">{day.date.includes("test") ? format(new Date(parseInt(day.date.split("-").pop() || "0") * 30000), "MMM do, h:mm a") : format(new Date(day.date), "MMMM do, yyyy")}</h3>
                            <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                              Mission Completed <CheckCircle2 size={12} />
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const db = await getDb();
                              const m1Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q1_id]) as any[];
                              const m2Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q2_id]) as any[];
                              if (m1Res.length && m2Res.length) {
                                setMissions([m1Res[0], m2Res[0]]);
                                setActiveMission(m1Res[0]);
                                setCurrentView('workspace');
                              }
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-claude-accent hover:text-white transition-colors flex items-center gap-2 group"
                          >
                            RESUME MISSION <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: day.q1_id, name: day.q1_name, qidx: 0, done: day.q1_completed },
                            { id: day.q2_id, name: day.q2_name, qidx: 1, done: day.q2_completed }
                          ].map((q) => {
                            if (!q.done) return null;
                            return (
                              <div key={q.id} className="flex flex-col gap-2.5 p-3.5 rounded-lg bg-green-500/5 border border-green-500/10 group/q transition-all hover:bg-green-500/10 active:scale-[0.98]">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-bold text-green-400 uppercase tracking-[0.25em] opacity-60">Protocol {q.qidx + 1}</span>
                                  <h4 className="text-base font-semibold text-claude-text leading-tight">{q.name}</h4>
                                  <div className="mt-0.5"><span className="text-[9px] font-bold text-green-400 uppercase tracking-widest opacity-80 flex items-center gap-2">SOLVED <CheckCircle2 size={10} /></span></div>
                                </div>
                                <div className="flex items-center gap-6 mt-auto pt-1">
                                  <button
                                    onClick={async () => {
                                      const db = await getDb();
                                      const m1Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q1_id]) as any[];
                                      const m2Res = await db.select("SELECT * FROM missions WHERE id = $1", [day.q2_id]) as any[];
                                      setMissions([m1Res[0], m2Res[0]]);
                                      setActiveMission(q.qidx === 0 ? m1Res[0] : m2Res[0]);
                                      setCurrentView('workspace');
                                    }}
                                    className="text-[10px] text-claude-accent hover:text-white font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all hover:gap-3"
                                  >
                                    <Code2 size={13} /> Solution
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const db = await getDb();
                                      const m = await db.select("SELECT leetcode_url FROM missions WHERE id = $1", [q.id]) as any[];
                                      if (m[0]?.leetcode_url) open(m[0].leetcode_url);
                                    }}
                                    className="text-[10px] text-claude-muted hover:text-claude-accent font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all"
                                  >
                                    <ExternalLink size={13} /> LeetCode
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentView === "inventory" && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 overflow-hidden"
            >
              <Inventory />
            </motion.div>
          )}

          {currentView === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col pt-12 pl-12 pb-12 overflow-hidden"
            >
              <SystemThemeRoot />
              <div className="w-full flex h-full">
                {/* Left Sidebar */}
                <div className="w-64 flex flex-col gap-1 pr-8">
                  <h2 className="text-xl font-medium tracking-tight mb-8 px-2">Settings</h2>

                  {([
                    { id: "profile", label: "System Profile" },
                    { id: "changelog", label: "Changelogs" },
                    { id: "customization", label: "Customization" },
                    { id: "process", label: "Process Core" },
                    { id: "feedback", label: "Feedback Hub" },
                    { id: "danger", label: "Atomic Wipe" },
                    { id: "general", label: "About" },
                    ...(localUser?.role === "Admin Observer" ? [{ id: "admin", label: "Admin Insight" } as const] : []),
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSettingsTab(tab.id)}
                      className={`px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-all ${settingsTab === tab.id
                        ? "bg-claude-hover text-claude-text shadow-sm"
                        : "text-claude-muted hover:text-claude-text hover:bg-claude-hover/30"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}

                  <div className="mt-auto px-4 py-4 space-y-1">
                    <p className="text-[10px] font-black text-claude-muted/40 uppercase tracking-[0.2em]">Qued System</p>
                    <p className="text-[10px] font-mono text-indigo-400/50 uppercase tracking-widest">Build v1.0.1</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pl-8 pr-12 border-l border-claude-border custom-scrollbar">
                  <div className="max-w-4xl mx-auto w-full">
                    <AnimatePresence mode="wait">
                      {/* Changelog Tab */}
                      {settingsTab === "changelog" && (
                        <motion.div
                          key="changelog"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-8"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                              <ScrollText size={20} className="text-indigo-400" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black uppercase tracking-tighter">Changelogs</h3>
                              <p className="text-xs text-claude-muted">System logs and enhancement chronicles.</p>
                            </div>
                          </div>

                          <div className="space-y-12 pt-4">
                            {CHANGELOG.map((entry, idx) => (
                              <div key={entry.version} className="relative pl-10 border-l border-claude-border pb-4">
                                <div className="absolute top-0 left-[-5px] w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                                <div className="space-y-4">
                                  <div className="flex justify-between items-end">
                                    <div>
                                      <h4 className="text-lg font-bold text-white uppercase tracking-tight">{entry.title}</h4>
                                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mt-1">Version {entry.version}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-claude-muted uppercase tracking-widest">{entry.date}</span>
                                  </div>
                                  <ul className="space-y-3">
                                    {entry.changes.map((change, i) => (
                                      <li key={i} className="flex gap-4 items-start group">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-claude-accent/30 group-hover:bg-claude-accent transition-colors shrink-0" />
                                        <span className="text-sm text-claude-muted group-hover:text-claude-text transition-colors leading-relaxed">{change}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Profile Tab */}
                      {settingsTab === "profile" && (
                        <motion.div
                          key="profile"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-10"
                        >
                          <div className="flex items-center gap-6">
                            <div className="relative group">
                              <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden relative">
                                {useEditorStore.getState().profilePic ? (
                                  <img
                                    src={useEditorStore.getState().profilePic!}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    alt="Profile"
                                  />
                                ) : (
                                  <User size={40} className="text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                                )}
                                <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full opacity-50 pulse" />
                              </div>

                              <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-claude-accent text-white rounded-xl shadow-lg border-2 border-claude-bg flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all">
                                <Sparkles size={14} />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        useEditorStore.getState().setProfilePic(reader.result as string);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <div>
                              <h3 className="text-2xl font-black tracking-tight text-white mb-1 uppercase tracking-tighter">{localUser?.name}</h3>
                              <p className="text-xs font-mono text-white/30 uppercase tracking-[0.2em] mb-4">System Identifier: {localUser?.id?.substring(0, 12)}...</p>

                              <div className="flex gap-3">
                                <div className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Active Core</span>
                                </div>
                                <div className="px-3 py-1.5 bg-claude-hover/30 border border-claude-border/30 rounded-lg flex items-center gap-2">
                                  <Sparkles size={10} className="text-amber-400" />
                                  <span className="text-[10px] font-black uppercase text-claude-muted tracking-widest">Core V1.0</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-claude-hover/20 border border-claude-border/20 rounded-3xl p-8 space-y-6">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                              <span className="text-xs font-bold uppercase tracking-widest text-claude-muted">Status</span>
                              <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Verified Human</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                              <span className="text-xs font-bold uppercase tracking-widest text-claude-muted">Registry Date</span>
                              <span className="text-xs font-bold text-white uppercase tracking-widest">April 10, 2026</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase tracking-widest text-claude-muted">Security Tier</span>
                              <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{localUser?.role || "Authorized User"}</span>
                            </div>
                          </div>

                          <div className="pt-8">
                            <button
                              onClick={handleLogout}
                              className="px-10 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-3"
                            >
                              <X size={14} />
                              Sever Connection
                            </button>
                            <p className="mt-4 text-[9px] font-bold text-claude-muted/40 uppercase tracking-[0.1em] px-2 italic">Proceeding will clear active link tokens and return to authentication gateway.</p>
                          </div>
                        </motion.div>
                      )}

                      {/* Customization Tab */}
                      {settingsTab === "customization" && (
                        <CustomizationPane />
                      )}

                      {/* General Tab */}
                      {settingsTab === "general" && (
                        <motion.div
                          key="general"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-10"
                        >
                          <div className="mb-10 text-center relative">
                            <h1 className="text-5xl font-black tracking-tighter text-white mb-2 uppercase italic">
                              QUED
                            </h1>
                            <p className="text-[10px] font-bold text-claude-muted uppercase tracking-[0.4em] opacity-50">High-Velocity Engineering Archive</p>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Environment Name</label>
                              <div className="p-3 bg-claude-panel border border-claude-border rounded-xl text-sm text-claude-muted cursor-not-allowed">
                                Qued System v1.0.1
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Local Version</label>
                              <div className="p-3 bg-claude-panel border border-claude-border rounded-xl text-sm text-indigo-400 font-mono cursor-not-allowed">
                                v1.0.1
                              </div>
                            </div>
                          </div>

                          <div className="bg-claude-bg/50 border border-claude-border/40 rounded-3xl p-8 mb-8">
                            <p className="text-sm text-claude-muted leading-relaxed font-sans italic opacity-80">
                              Qued is a high-performance, personalized DSA Command Center integrated with Striver's A2Z blueprint.
                              Beyond tracking, it features a persistent Intelligence Archive for engineering notes, a reactive theme engine with environment profiles,
                              and a local Socratic mentor powered by Ollama. Built to eliminate digital noise and accelerate technical mastery.
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Process Core Tab */}
                      {settingsTab === "process" && (
                        <motion.div
                          key="process"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-8"
                        >
                          <div>
                            <h3 className="text-lg font-medium mb-1">Process Core</h3>
                            <p className="text-xs text-claude-muted mb-8">Configure hardware-agnostic assessment providers.</p>

                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Provider Pipeline</label>
                                <div className="flex gap-2">
                                  {["ollama", "ollama_cloud", "groq", "openrouter"].map(p => (
                                    <button
                                      key={p}
                                      onClick={() => {
                                        setApiProvider(p as any);
                                        localStorage.setItem("provider", p);
                                      }}
                                      className={`px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all ${apiProvider === p
                                        ? "bg-claude-accent border-claude-accent text-white shadow-lg"
                                        : "bg-claude-panel border-claude-border text-claude-muted hover:border-claude-muted"
                                        }`}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {apiProvider !== "ollama" && (
                                <>
                                  <div className="grid grid-cols-2 gap-6 pt-4">
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">API Access Key</label>
                                      <input
                                        type="password"
                                        value={externalApiKey}
                                        onChange={(e) => {
                                          setExternalApiKey(e.target.value);
                                          localStorage.setItem("api_key", e.target.value);
                                        }}
                                        placeholder="Enter secure hash..."
                                        className="w-full p-3 bg-claude-bg border border-claude-border rounded-xl text-sm font-mono focus:border-claude-accent outline-none"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Model ID</label>
                                      <input
                                        type="text"
                                        value={externalModel}
                                        onChange={(e) => {
                                          setExternalModel(e.target.value);
                                          localStorage.setItem("model", e.target.value);
                                        }}
                                        placeholder="e.g. gemma2:9b"
                                        className="w-full p-3 bg-claude-bg border border-claude-border rounded-xl text-sm font-mono focus:border-claude-accent outline-none"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Gateway Base URL (Optional)</label>
                                    <input
                                      type="text"
                                      value={externalBaseUrl}
                                      onChange={(e) => {
                                        setExternalBaseUrl(e.target.value);
                                        localStorage.setItem("base_url", e.target.value);
                                      }}
                                      placeholder="http://localhost:11434/v1"
                                      className="w-full p-3 bg-claude-bg border border-claude-border rounded-xl text-sm font-mono focus:border-claude-accent outline-none"
                                    />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Danger Zone Tab */}
                      {settingsTab === "danger" && (
                        <motion.div
                          key="danger"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-8"
                        >
                          <div>
                            <h3 className="text-lg font-medium mb-1 text-red-500">Atomic Reset</h3>
                            <p className="text-xs text-claude-muted mb-8">High-risk operations that cannot be reversed.</p>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex justify-between items-center mb-4">
                              <div>
                                <h4 className="font-bold text-sm text-red-400 mb-1">Hard Wipe Workspace</h4>
                                <p className="text-xs text-claude-muted">Clears all solving history, notes, and local drafts.</p>
                              </div>
                              <button
                                onClick={handleHardReset}
                                className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                              >
                                Execute Wipe
                              </button>
                            </div>

                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-sm text-orange-400 mb-1">Sever Cloud Identity</h4>
                                <p className="text-xs text-claude-muted">Permanently deletes your registry record from the server.</p>
                              </div>
                              <button
                                onClick={handleCloudPurge}
                                className="px-6 py-2.5 border border-orange-500/50 hover:bg-orange-500/10 text-orange-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                              >
                                Purge Registry
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Feedback Tab */}
                      {settingsTab === "feedback" && (
                        <motion.div
                          key="feedback"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-8"
                        >
                          <div>
                            <h3 className="text-xl font-bold mb-2 uppercase tracking-tighter">Feedback Hub</h3>
                            <p className="text-xs text-claude-muted mb-10">Help refine the Qued workstation. All feedback is direct-piped to core developers.</p>

                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Report / Suggestion</label>
                                <textarea
                                  value={feedbackInput}
                                  onChange={(e) => setFeedbackInput(e.target.value)}
                                  placeholder="Describe the anomaly or proposed enhancement..."
                                  rows={6}
                                  className="w-full p-6 bg-claude-panel/50 border border-claude-border rounded-[2rem] text-sm text-white resize-none outline-none focus:border-claude-accent transition-all font-sans leading-relaxed"
                                />
                              </div>

                              <button
                                onClick={submitFeedback}
                                disabled={sendingFeedback || !feedbackInput.trim()}
                                className="w-full py-5 bg-claude-accent hover:opacity-90 disabled:opacity-30 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] shadow-2xl"
                              >
                                {sendingFeedback ? "Transmitting..." : "Ship Feedback"}
                              </button>

                              <p className="text-[10px] text-center text-claude-muted font-bold uppercase tracking-widest opacity-40 italic">
                                Transmission is encrypted and includes your system identifier.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Admin Tab */}
                      {settingsTab === "admin" && localUser?.role === "Admin Observer" && (
                        <motion.div
                          key="admin"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-8"
                        >
                          <div>
                            <div className="flex justify-between items-end mb-8">
                              <div>
                                <h3 className="text-xl font-bold mb-2 uppercase tracking-tighter text-indigo-400">Admin Insight</h3>
                                <p className="text-xs text-claude-muted">Monitoring system-wide user signals and feedback.</p>
                              </div>
                              <button
                                onClick={fetchFeedbackList}
                                className="p-2 text-claude-muted hover:text-white transition-colors"
                              >
                                <Sparkles size={16} />
                              </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                              {feedbackList.length === 0 ? (
                                <div className="p-12 border-2 border-dashed border-claude-border/30 rounded-[2rem] text-center">
                                  <p className="text-xs font-bold text-claude-muted uppercase tracking-widest italic">No incoming signals detected.</p>
                                </div>
                              ) : (
                                feedbackList.map((f) => (
                                  <div key={f.id} className="p-6 bg-claude-panel/50 border border-claude-border rounded-[2rem] space-y-4">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">{f.user_name}</p>
                                        <p className="text-[9px] font-mono text-claude-muted uppercase italic">{f.user_id}</p>
                                      </div>
                                      <span className="text-[9px] font-bold text-claude-muted/50 uppercase">
                                        {new Date(f.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-sm text-claude-text font-sans leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 italic">
                                      "{f.content}"
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentView === "test" && (
            <motion.div
              key="test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 overflow-hidden"
            >
              <WeeklyTest />
            </motion.div>
          )}

          {currentView === "duel" && (
            <motion.div
              key="duel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-claude-bg flex flex-col items-center justify-center p-12 text-center"
            >
              <div className="w-24 h-24 rounded-3xl bg-claude-hover/50 flex items-center justify-center mb-8 border border-claude-border/20 shadow-2xl">
                <Swords size={48} className="text-claude-accent opacity-50 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-widest text-claude-text mb-4">Combat Arena</h2>
              <div className="bg-claude-accent/10 border border-claude-accent/20 px-4 py-1.5 rounded-full mb-8">
                <span className="text-[10px] font-black uppercase tracking-tighter text-claude-accent">Protocol in Development</span>
              </div>
              <p className="max-w-md text-claude-muted text-sm leading-relaxed mb-12">
                The multiplayer combat evaluation layer is currently undergoing calibration. Real-time judge circuits and fairness protocols are being finalized.
              </p>
              <button
                onClick={() => setCurrentView("tasks")}
                className="px-8 py-3 bg-claude-hover hover:bg-claude-border text-claude-accent rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
              >
                Return to Missions
              </button>
            </motion.div>
          )}

          {currentView === "interview" && (
            <motion.div
              key="interview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="absolute inset-0 z-[100] bg-claude-bg"
            >
              <InterviewModule
                onExit={() => setCurrentView("tasks")}
                apiProvider={apiProvider as any}
                externalApiKey={externalApiKey}
                externalModel={externalModel}
                baseUrl={externalBaseUrl}
              />
            </motion.div>
          )}

        </AnimatePresence>

        {/* ── CHILL ZONE UNLOCK TOAST ────────────────────────── */}
        <AnimatePresence>
          {showChillUnlockToast && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-8 left-16 right-0 z-[100000] flex justify-center pointer-events-none"
            >
              <div className="pointer-events-auto bg-indigo-600 border border-indigo-400/30 text-white px-6 py-4 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl flex items-center gap-5 min-w-[420px]">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Coffee size={24} strokeWidth={2.5} className="text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] leading-none mb-2 text-indigo-100">Daily Quota Met</h4>
                  <p className="text-sm font-semibold tracking-tight text-white leading-tight">Chill Zone is now unlocked for 15 minutes.</p>
                </div>
                <button
                  onClick={() => { setChillZoneActive(true); setShowChillUnlockToast(false); }}
                  className="px-5 py-2.5 bg-white text-indigo-600 text-[11px] font-black uppercase tracking-[0.1em] rounded-xl hover:scale-105 transition-all shadow-lg"
                >
                  Enter Zone
                </button>
                <button
                  onClick={() => setShowChillUnlockToast(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CHILL ZONE OVERLAY ────────────────────────── */}
        <AnimatePresence>
          {chillZoneActive && (
            <ChillZone onExit={handleExitChill} timeLeftMs={900000} />
          )}
        </AnimatePresence>

        {/* ── PERSISTENT WORKSPACE VIEW ─────────────────────────────── */}
        {activeMission && (
          <div className={`flex-1 h-full w-full flex-col min-h-0 absolute inset-0 p-0 transition-opacity duration-300 ${currentView === 'workspace' ? 'opacity-100 z-10' : 'opacity-0 -z-10 pointer-events-none'}`}>
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="flex-1 h-full w-full flex flex-col bg-claude-panel border border-claude-border/5 rounded-xl overflow-hidden shadow-2xl relative"
            >
              <header className="h-14 shrink-0 border-b border-claude-border/5 bg-claude-hover/10 flex items-center justify-between px-6 z-10 transition-all">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center gap-2">
                    {missions.map((m: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setActiveMission(m)}
                        className={`text-[10px] font-bold uppercase tracking-widest px-5 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 border ${activeMission?.id === m.id
                          ? "bg-claude-bg border-claude-accent/20 text-claude-accent shadow-sm scale-[1.02]"
                          : "bg-transparent border-transparent text-claude-muted hover:border-claude-border/10 hover:bg-claude-hover/50 hover:text-claude-text"
                          }`}
                      >
                        {activeMission?.id === m.id ? <CheckCircle2 size={13} className="text-claude-accent" /> : <Circle size={13} />}
                        Q{idx + 1}: {m.name?.substring(0, 20)}...
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleMission(activeMission.id)} className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border-2 transition-all ${(activeMission.id === missions[0]?.id ? q1Done : q2Done) ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-claude-border text-claude-muted hover:border-claude-muted"}`}>
                    <CheckCircle2 size={13} /> {(activeMission.id === missions[0]?.id ? q1Done : q2Done) ? "Completed" : "Mark done"}
                  </button>
                  <button onClick={() => open(activeMission.leetcode_url)} className="text-sm font-medium text-claude-muted hover:text-claude-accent flex items-center gap-2 transition-colors py-1.5 px-3 rounded-md hover:bg-claude-hover">
                    <ExternalLink size={13} /> LeetCode
                  </button>
                </div>
              </header>

              <div className="flex-1 flex overflow-hidden p-1 bg-claude-bg/30 relative gap-0">
                {/* ── COLLAPSED RAIL ─────────────────────────────── */}
                {(leftPanelCollapsed || editorCollapsed || rightPanelCollapsed) && (
                  <div className="flex flex-col gap-3 shrink-0 py-2 w-[40px] justify-center items-center px-1">
                    {leftPanelCollapsed && (
                      <div
                        onClick={() => setLeftPanelCollapsed(false)}
                        className="w-full flex-1 max-h-[300px] min-h-[100px] bg-claude-panel border border-claude-border/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-claude-hover/30 transition-all group shadow-sm"
                      >
                        <span className="[writing-mode:vertical-lr] rotate-180 text-[9px] font-black tracking-[0.2em] text-claude-muted/40 flex items-center justify-center gap-3 group-hover:text-claude-accent transition-colors">
                          <ChevronRight size={12} className="mb-2" /> MISSION
                        </span>
                      </div>
                    )}
                    {editorCollapsed && (
                      <div
                        onClick={() => setEditorCollapsed(false)}
                        className="w-full flex-1 max-h-[300px] min-h-[100px] bg-claude-panel border border-claude-border/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-claude-hover/30 transition-all group shadow-sm"
                      >
                        <span className="[writing-mode:vertical-lr] rotate-180 text-[9px] font-black tracking-[0.2em] text-claude-muted/40 flex items-center justify-center gap-3 group-hover:text-claude-accent transition-colors">
                          <ChevronRight size={12} className="mb-2" /> EDITOR
                        </span>
                      </div>
                    )}
                    {rightPanelCollapsed && (
                      <div
                        onClick={() => setRightPanelCollapsed(false)}
                        className="w-full flex-1 max-h-[300px] min-h-[100px] bg-claude-panel border border-claude-border/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-claude-hover/30 transition-all group shadow-sm"
                      >
                        <span className="[writing-mode:vertical-lr] rotate-180 text-[9px] font-black tracking-[0.2em] text-claude-muted/40 flex items-center justify-center gap-3 group-hover:text-claude-accent transition-colors">
                          <ChevronLeft size={12} className="mb-2" /> WALKTHROUGH
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MISSION PARAMS ─────────────────────────────── */}
                {!leftPanelCollapsed && (
                  <div
                    className={`flex flex-col min-h-0 relative overflow-hidden ${editorCollapsed ? "flex-1" : "shrink-0"}`}
                    style={{ width: editorCollapsed ? 'auto' : `${leftWidth}px` }}
                  >
                    <div className="flex-1 bg-claude-panel border border-claude-border/10 rounded-xl overflow-hidden flex flex-col min-h-0 relative">
                      <div style={{ height: '32px' }} className="px-5 border-b border-claude-border/40 bg-claude-hover/30 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                          <Bot size={13} className="text-claude-accent" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Mentor</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[9px] font-bold text-claude-muted opacity-50 flex items-center gap-1.5"><Monitor size={10} /> ACTIVE</span>
                          <button
                            onClick={() => setLeftPanelCollapsed(true)}
                            className="p-1 hover:bg-claude-hover/90 rounded text-claude-muted hover:text-claude-text transition-all focus:outline-none"
                            title="Collapse Mentor"
                          >
                            <ChevronLeft size={14} />
                          </button>
                        </div>
                      </div>
                      {/* Mission Parameters & Chat split */}
                      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* Mission Parameters (Description, Constraints & Examples) */}
                        {activeMission && (
                          <div className="shrink-0 border-b border-claude-border/20 bg-claude-panel/30 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto px-3 py-0.5 scrollbar-hide">
                              {activeMission.description && (
                                <details className="group" open>
                                  <summary className="text-[9px] uppercase tracking-[0.2em] text-claude-muted/80 py-1 font-bold flex items-center gap-1.5 cursor-pointer list-none hover:text-claude-accent transition-colors">
                                    <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-claude-muted/50 group-open:rotate-180 transition-transform" />
                                    <Activity size={9} /> Description
                                  </summary>
                                  <div className="pb-2 pt-0 px-2">
                                    <p className="text-[12.5px] text-claude-text/80 leading-relaxed italic border-l border-claude-accent/20 pl-2.5 py-0.5">
                                      {activeMission.description}
                                    </p>
                                  </div>
                                </details>
                              )}

                              {activeMission.constraints && activeMission.constraints.length > 0 && (
                                <details className="group" open>
                                  <summary className="text-[9px] uppercase tracking-[0.2em] text-claude-muted/80 py-1 font-bold flex items-center gap-1.5 cursor-pointer list-none hover:text-claude-accent transition-colors">
                                    <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-claude-muted/50 group-open:rotate-180 transition-transform" />
                                    <Activity size={9} /> Constraints
                                  </summary>
                                  <div className="pb-1.5 pt-0">
                                    <ul className="space-y-0.5 antialiased text-[10.5px]">
                                      {Array.isArray(activeMission.constraints) && activeMission.constraints.map((c: string, idx: number) => (
                                        <li key={idx} className="text-claude-text/60 font-mono flex gap-1.5 leading-tight">
                                          <span className="text-claude-accent/20">•</span>
                                          {c}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </details>
                              )}

                              {activeMission.test_cases && (
                                <details className="group" open>
                                  <summary className="text-[9px] uppercase tracking-[0.2em] text-claude-muted/80 py-1 font-bold flex items-center gap-1.5 cursor-pointer list-none hover:text-claude-accent transition-colors border-t border-claude-border/10 mt-0.5">
                                    <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-claude-muted/50 group-open:rotate-180 transition-transform" />
                                    <TerminalSquare size={9} /> Examples
                                  </summary>
                                  <div className="pb-1.5 pt-0">
                                    <div className="space-y-1.5">
                                      {Array.isArray(activeMission.test_cases) && activeMission.test_cases.slice(0, 2).map((tc: any, idx: number) => (
                                        <div key={idx} className="bg-claude-bg/30 border border-claude-border/10 rounded px-1.5 py-1 font-mono text-[10px]">
                                          <div className="flex gap-2">
                                            <span className="text-claude-muted/40 w-8 shrink-0 uppercase tracking-tighter">In</span>
                                            <span className="text-claude-text/70 break-all">{tc.input}</span>
                                          </div>
                                          <div className="flex gap-2">
                                            <span className="text-claude-muted/40 w-8 shrink-0 uppercase tracking-tighter">Out</span>
                                            <span className="text-claude-accent/60 break-all">{tc.output}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <MissionChat
                            activeMission={activeMission}
                            currentCode={currentCode}
                            apiProvider={apiProvider as any}
                            externalApiKey={externalApiKey}
                            externalModel={externalModel}
                            baseUrl={externalBaseUrl}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── LEFT RESIZER ─────────────────────────────── */}
                {!leftPanelCollapsed && (!editorCollapsed || !rightPanelCollapsed) && (
                  <div
                    onMouseDown={() => setIsResizingLeft(true)}
                    className="w-1 bg-transparent transition-all cursor-col-resize active:bg-claude-accent/20 z-30 flex justify-center group/resizer"
                  >
                    <div className={`w-[1px] h-full ${isResizingLeft ? 'bg-claude-accent' : 'bg-transparent group-hover/resizer:bg-claude-accent/10'} transition-colors`} />
                  </div>
                )}

                {/* ── EDITOR ─────────────────────────────── */}
                {!editorCollapsed && (
                  <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-transparent px-1 overflow-hidden">
                    <div className="flex-1 min-h-0 min-w-0 bg-claude-panel border border-claude-border/10 rounded-2xl shadow-sm relative overflow-hidden flex flex-col">
                      <MissionEditor
                        activeMission={activeMission}
                        onCodeChange={setCurrentCode}
                        onCollapse={() => setEditorCollapsed(true)}
                      />
                    </div>
                  </div>
                )}

                {/* ── RIGHT RESIZER ─────────────────────────────── */}
                {!rightPanelCollapsed && (!editorCollapsed || !leftPanelCollapsed) && (
                  <div
                    onMouseDown={() => setIsResizingRight(true)}
                    className="w-1 bg-transparent transition-all cursor-col-resize active:bg-claude-accent/20 z-30 flex justify-center group/resizer"
                  >
                    <div className={`w-[1px] h-full ${isResizingRight ? 'bg-claude-accent' : 'bg-transparent group-hover/resizer:bg-claude-accent/10'} transition-colors`} />
                  </div>
                )}

                {/* ── RIGHT PANEL ─────────────────────────────── */}
                {!rightPanelCollapsed && (
                  <div
                    className={`flex flex-col min-h-0 relative overflow-hidden ${(leftPanelCollapsed && editorCollapsed) ? "flex-1" : "shrink-0"}`}
                    style={{ width: (leftPanelCollapsed && editorCollapsed) ? 'auto' : `${rightWidth}px` }}
                  >
                    <div className="flex-1 bg-claude-panel border border-claude-border/10 rounded-2xl overflow-hidden flex flex-col min-h-0">
                      <div className="flex-1 flex flex-col min-h-0">
                        <div
                          className="p-1 bg-claude-bg/20 relative flex flex-col"
                          style={{ height: `${walkthroughHeight}px` }}
                        >
                          <div className="absolute top-2 left-2 z-[40]">
                            <button
                              onClick={(e) => { e.stopPropagation(); setRightPanelCollapsed(true); }}
                              className="p-1.5 hover:bg-claude-hover/90 bg-claude-bg/60 backdrop-blur-md rounded-lg text-claude-muted hover:text-claude-text transition-all border border-claude-border/30 shadow-2xl group focus:outline-none"
                            >
                              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                          <div className={`flex-1 min-h-0 bg-black rounded-xl overflow-hidden relative border border-claude-border/40 ${isResizingWalkthrough || isResizingRight || isResizingLeft ? "pointer-events-none" : ""}`}>
                            {missions.map((m: any) => (
                              <div
                                key={m.id}
                                className={`absolute inset-0 transition-opacity duration-300 ${activeMission?.id === m.id ? "opacity-100 z-10" : "opacity-0 -z-10 pointer-events-none"}`}
                              >
                                {m.youtube_url ? (
                                  <iframe
                                    src={`https://www.youtube.com/embed/${getYouTubeId(m.youtube_url)}?enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}`}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-claude-bg/50">
                                    <AlertCircle size={32} className="text-claude-muted opacity-30" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-claude-muted/50">Video walkthrough not available</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div
                            onMouseDown={() => setIsResizingWalkthrough(true)}
                            className="h-1 bg-transparent hover:bg-claude-accent/20 cursor-row-resize absolute bottom-0 left-0 right-0 z-30 group/hresizer"
                          >
                            <div className={`h-[1px] w-full ${isResizingWalkthrough ? 'bg-claude-accent' : 'bg-transparent group-hover/hresizer:bg-claude-accent/10'} transition-colors`} />
                          </div>
                        </div>
                        <div className="flex-1 min-h-0 border-t border-claude-border/40">
                          <Scratchpad date={activeMission?.date || format(new Date(), "yyyy-MM-dd")} activeMission={activeMission} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {
        showShortcuts && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-claude-panel border border-claude-border rounded-[2rem] p-10 max-w-md w-full relative shadow-2xl">
              <h2 className="text-xl font-bold mb-8 flex items-center gap-3"><Keyboard size={20} className="text-claude-accent" /> System Shortcuts</h2>
              <div className="space-y-4">
                {[
                  { k: "⌘ 1", d: "Qued Protocols" },
                  { k: "⌘ 2", d: "Qued Workspace" },
                  { k: "⌘ 3", d: "Progress Analytics" },
                  { k: "⌘ ,", d: "System Settings" },
                  { k: "⌘ ?", d: "Toggle Shortcuts" },
                ].map(s => (
                  <div key={s.k} className="flex justify-between items-center py-3 border-b border-claude-border/30">
                    <span className="text-claude-muted text-sm">{s.d}</span>
                    <span className="font-mono text-xs bg-claude-hover px-3 py-1.5 rounded-lg border border-claude-border/50 text-claude-accent">{s.k}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowShortcuts(false)} className="w-full mt-10 py-3 bg-claude-hover hover:bg-claude-border transition-colors rounded-xl text-sm font-bold uppercase tracking-widest text-claude-accent">Acknowledge</button>
            </motion.div>
          </div>
        )
      }
    </div >
  );
}

