"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, Search, Loader2, Music2,
  Shuffle, Repeat, Wind, Zap, Sun,
  ChevronRight, ListMusic, Maximize2, Layers,
  Activity, Sliders, Waves, Settings2, X, RotateCcw
} from "lucide-react";
import Pong from "./games/Pong";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "vibes" | "games" | "music";

interface Track {
  id: string; name: string; artist: string; image: string; audio: string; duration: number;
}

interface VibeTheme {
  id: string; label: string; sub: string; Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  accent: string; bg: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const JAMENDO_ID = "db9569db";

const VIBES: VibeTheme[] = [
  { id: "lofi", label: "Lo-Fi Study", sub: "Soft focus diffusion", Icon: Wind, accent: "#818cf8", bg: "#1e1b4b" },
  { id: "ambient", label: "Deep Ambient", sub: "Pressure release protocol", Icon: Wind, accent: "#34d399", bg: "#064e3b" },
  { id: "focus", label: "Crystal Flow", sub: "High coherence state", Icon: Zap, accent: "#c084fc", bg: "#3b0764" },
  { id: "nature", label: "Zen Garden", sub: "Ground + breathe", Icon: Sun, accent: "#fbbf24", bg: "#451a03" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000);
  return `${m}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
}

function getStreamUrl(id: string) {
  return `https://mp3l.jamendo.com/?trackid=${id}&format=mp3&from=app&client_id=${JAMENDO_ID}`;
}

async function fetchTracks(query = ""): Promise<Track[]> {
  const params = new URLSearchParams({ client_id: JAMENDO_ID, format: "json", limit: "40", include: "musicinfo", order: "popularity_week", audioformat: "mp32" });
  const baseUrl = `https://api.jamendo.com/v3.0/tracks/?${params.toString()}`;
  const finalUrl = baseUrl + (query ? `&search=${encodeURIComponent(query)}` : `&tags=lofi,chillout`);
  try {
    const res = await fetch(finalUrl);
    if (!res.ok) throw new Error("Gateway Refusal");
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      id: r.id, name: r.name, artist: r.artist_name, image: r.album_image || r.image || "", audio: r.audio || getStreamUrl(r.id), duration: r.duration,
    }));
  } catch (e) {
    return [];
  }
}

// ─── Components ────────────────────────────────────────────────────────────────

function BarViz({ active, accent }: { active: boolean; accent: string }) {
  const heights = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.9, 0.65];
  return (
    <div className="flex items-end gap-[2px] h-4 shrink-0">
      {heights.map((h, i) => (
        <motion.div key={i} style={{ background: accent, width: 2, originY: 1, borderRadius: 1 }} animate={active ? { scaleY: [h, 1, h * 0.6, 1, h] } : { scaleY: h * 0.3 }} transition={{ duration: 0.8 + i * 0.07, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }} />
      ))}
    </div>
  );
}

function TrackRow({ track, index, current, playing, accent, onClick }: { track: Track; index: number; current: boolean; playing: boolean; accent: string; onClick: () => void; }) {
  return (
    <motion.button onClick={onClick} whileHover={{ x: 4 }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors group ${current ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
      <div className="w-7 flex items-center justify-center shrink-0">
        {current && playing ? <BarViz active accent={accent} /> : <span className={`text-xs font-mono tabular-nums ${current ? "text-white" : "text-white/30"}`}>{index + 1}</span>}
      </div>
      <img src={track.image || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=48&h=48&fit=crop"} onError={e => (e.currentTarget.src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=48&h=48&fit=crop")} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
      <div className="flex-1 min-w-0"><p className={`text-sm font-medium truncate leading-tight ${current ? "text-white" : "text-white/70"}`}>{track.name}</p><p className="text-xs text-white/30 truncate mt-0.5">{track.artist}</p></div>
      <span className="text-xs text-white/20 font-mono tabular-nums shrink-0">{fmt(track.duration)}</span>
    </motion.button>
  );
}

// ─── Main Logic ───────────────────────────────────────────────────────────────

export default function ChillZone({ onExit, timeLeftMs }: { onExit: () => void; timeLeftMs: number }) {
  const [timeLeft, setTimeLeft] = useState(timeLeftMs);
  const [activeTab, setActiveTab] = useState<Tab>("music");
  const [vibe, setVibe] = useState(VIBES[0]);
  const [showQueue, setShowQueue] = useState(true);
  const [showFX, setShowFX] = useState(false);

  // Music state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState(false);
  const [query, setQuery] = useState("");

  // FX state
  const [pitch, setPitch] = useState(1.0);
  const [reverb, setReverb] = useState(0.0);
  const [eqBass, setEqBass] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);

  const eqBassRef = useRef<BiquadFilterNode | null>(null);
  const eqMidRef = useRef<BiquadFilterNode | null>(null);
  const eqHighRef = useRef<BiquadFilterNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);

  const onExitRef = useRef(onExit);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  // ── Timer Loop
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => { setTimeLeft(p => { if (p <= 1000) { clearInterval(id); onExitRef.current(); return 0; } return p - 1000; }); }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Sync FX
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
      audioRef.current.playbackRate = pitch;
      (audioRef.current as any).preservesPitch = false;
      (audioRef.current as any).mozPreservesPitch = false;
      (audioRef.current as any).webkitPreservesPitch = false;
    }
    if (gainRef.current) gainRef.current.gain.setTargetAtTime(muted ? 0 : volume, 0, 0.01);
  }, [volume, muted, pitch]);

  useEffect(() => {
    if (eqBassRef.current) eqBassRef.current.gain.setTargetAtTime(eqBass, 0, 0.01);
    if (eqMidRef.current) eqMidRef.current.gain.setTargetAtTime(eqMid, 0, 0.01);
    if (eqHighRef.current) eqHighRef.current.gain.setTargetAtTime(eqHigh, 0, 0.01);
  }, [eqBass, eqMid, eqHigh]);

  useEffect(() => { if (dryGainRef.current && wetGainRef.current) { dryGainRef.current.gain.setTargetAtTime(1 - reverb, 0, 0.01); wetGainRef.current.gain.setTargetAtTime(reverb, 0, 0.01); } }, [reverb]);

  const initCtx = useCallback(() => {
    if (ctxRef.current || !audioRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const b = ctx.createBiquadFilter(); b.type = "lowshelf"; b.frequency.value = 250;
      const m = ctx.createBiquadFilter(); m.type = "peaking"; m.frequency.value = 1000; m.Q.value = 1;
      const h = ctx.createBiquadFilter(); h.type = "highshelf"; h.frequency.value = 4000;
      const conv = ctx.createConvolver();
      const len = ctx.sampleRate * 2.5; const buff = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const data = buff.getChannelData(c); for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8); }
      conv.buffer = buff;
      const dry = ctx.createGain(); const wet = ctx.createGain(); const ana = ctx.createAnalyser(); ana.fftSize = 512; const gain = ctx.createGain(); const src = ctx.createMediaElementSource(audioRef.current);
      src.connect(b); b.connect(m); m.connect(h); h.connect(dry); h.connect(conv); conv.connect(wet); dry.connect(ana); wet.connect(ana); ana.connect(gain); gain.connect(ctx.destination);
      ctxRef.current = ctx; analyserRef.current = ana; gainRef.current = gain; sourceRef.current = src; eqBassRef.current = b; eqMidRef.current = m; eqHighRef.current = h; dryGainRef.current = dry; wetGainRef.current = wet;
    } catch (e) { }
  }, []);

  const next = useCallback(() => { if (!tracks.length) return; loadTrack(shuffle ? Math.floor(Math.random() * tracks.length) : (idx + 1) % tracks.length); }, [tracks, idx, shuffle]);

  const safePlay = useCallback(async (retryCount = 2) => {
    const audio = audioRef.current; if (!audio) return;
    try {
      initCtx(); if (ctxRef.current?.state === "suspended") await ctxRef.current.resume();
      const p = audio.play(); pendingRef.current = p; await p; pendingRef.current = null; setPlaying(true);
    } catch (e: any) {
      pendingRef.current = null;
      if (e.name !== "AbortError" && retryCount > 0) {
        const track = tracks[idx];
        audio.src = retryCount === 2 ? getStreamUrl(track.id) : track.audio;
        if (retryCount === 1) audio.removeAttribute("crossOrigin");
        else audio.setAttribute("crossOrigin", "anonymous");
        audio.load();
        setTimeout(() => safePlay(retryCount - 1), 600);
      } else if (retryCount === 0) next();
    }
  }, [initCtx, tracks, idx, next]);

  const loadTrack = useCallback(async (i: number, autoPlay = true) => {
    const track = tracks[i]; const audio = audioRef.current; if (!track || !audio) return;
    setIdx(i); setProgress(0); setCurrentSec(0); setPlaying(false);
    if (pendingRef.current) { try { await pendingRef.current; } catch { } }
    audio.pause(); audio.setAttribute("crossOrigin", "anonymous"); audio.src = track.audio; audio.load(); if (autoPlay) await safePlay();
  }, [tracks, safePlay]);

  const prev = useCallback(() => { if (!tracks.length) return; if (currentSec > 3 && audioRef.current) { audioRef.current.currentTime = 0; return; } loadTrack((idx - 1 + tracks.length) % tracks.length); }, [tracks, idx, currentSec, loadTrack]);
  const toggle = useCallback(async () => { if (!audioRef.current || (loading && !tracks.length)) return; if (playing) { if (pendingRef.current) { try { await pendingRef.current; } catch { } } audioRef.current.pause(); setPlaying(false); } else await safePlay(); }, [playing, loading, tracks, safePlay]);

  const load = useCallback(async (q = "", attempt = 0) => {
    setLoading(true); try {
      let t = await fetchTracks(q); if (!t.length && q !== "") t = await fetchTracks("");
      if (!t.length) throw new Error("Null Stream");
      setTracks(t); setIdx(0); setLoading(false);
      if (audioRef.current) { audioRef.current.setAttribute("crossOrigin", "anonymous"); audioRef.current.src = t[0].audio; audioRef.current.load(); }
    } catch (e) { if (attempt < 2) setTimeout(() => load(q, attempt + 1), 1000); else setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSearch = async () => { await load(query.trim() || ""); };

  const currentTrack = tracks[idx];
  const acc = vibe.accent;

  return (
    <div className="fixed inset-0 z-[20000] flex flex-col overflow-hidden select-none" style={{ background: "#08080f" }}>
      <audio ref={audioRef} onTimeUpdate={() => { const a = audioRef.current; if (a?.duration) { setCurrentSec(a.currentTime); setProgress((a.currentTime / a.duration) * 100); } }} onEnded={() => loop ? (audioRef.current!.currentTime = 0, audioRef.current!.play()) : next()} crossOrigin="anonymous" />

      <motion.div key={vibe.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2.5 }} className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 80% 60% at 15% 85%, ${vibe.bg}bb 0%, transparent 60%), radial-gradient(ellipse 55% 45% at 85% 15%, ${vibe.bg}77 0%, transparent 55%)` }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "120px" }} />

      {/* HEADER */}
      <div className="relative z-50 flex items-center justify-between px-8 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-1.5 bg-white/[0.04] p-1 rounded-full border border-white/[0.06]">
          {(["vibes", "games", "music"] as Tab[]).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-1.5 rounded-full text-[11px] font-black tracking-widest uppercase transition-all ${activeTab === t ? "text-black" : "text-white/30 hover:text-white/60"}`} style={activeTab === t ? { background: acc } : {}}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <Clock size={13} className="text-white/20" />
          <span className="font-mono text-sm text-white/35 tabular-nums">{fmtMs(timeLeft)}</span>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-hidden flex">
        <AnimatePresence mode="wait">
          {activeTab === "music" ? (
            <motion.div key="music" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-between py-10 relative">

                {/* HERO: ALBUM ART + INFO */}
                <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 px-8 py-4">
                  <div className={`flex flex-col gap-8 ${showQueue ? "max-w-[260px]" : "max-w-[340px]"} w-full justify-center`}>
                    <motion.div layout style={{ aspectRatio: "1 / 1" }} className="relative w-full rounded-[2.5rem] overflow-hidden bg-white/[0.03] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] shrink min-h-0 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        <motion.img key={currentTrack?.id || "ph"} src={currentTrack?.image || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&h=800&fit=crop"} onError={e => (e.currentTarget.src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&h=800&fit=crop")} alt="" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5 }} className="w-full h-full object-cover rounded-[2.5rem]" />
                      </AnimatePresence>
                      {loading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm"><Loader2 size={32} className="animate-spin text-white/20" /></div>}
                    </motion.div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <AnimatePresence mode="wait"><motion.p key={currentTrack?.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className={`${showQueue ? "text-base" : "text-xl"} text-white font-black leading-tight truncate tracking-tight text-center`}>{currentTrack?.name || "Neural Handshake..."}</motion.p></AnimatePresence>
                      <p className={`${showQueue ? "text-xs" : "text-sm"} text-white/30 truncate font-medium text-center`}>{currentTrack?.artist || "Protocol Selection"}</p>
                    </div>
                  </div>
                </div>

                {/* STATIONARY DECK */}
                <div className="w-full max-w-[480px] px-8 py-4 shrink-0">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                      <input type="range" min={0} max={100} step={0.1} value={isNaN(progress) ? 0 : progress} onChange={e => { if (audioRef.current?.duration) audioRef.current.currentTime = (parseFloat(e.target.value) / 100) * audioRef.current.duration }} className="w-full h-[6px] rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, ${acc} ${isNaN(progress) ? 0 : progress}%, rgba(255,255,255,0.06) ${isNaN(progress) ? 0 : progress}%)`, accentColor: acc }} />
                      <div className="flex justify-between font-mono text-[11px] text-white/20 tracking-widest uppercase"><span>{fmt(currentSec)}</span><span>{currentTrack ? fmt(currentTrack.duration) : "--:--"}</span></div>
                    </div>
                    <div className="flex flex-col gap-8 p-8 bg-white/[0.04] border border-white/10 rounded-[2.5rem] backdrop-blur-3xl shadow-3xl shadow-black group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-8">
                          <button onClick={prev} className="text-white/30 hover:text-white transition-all transform hover:-translate-x-1"><SkipBack size={24} /></button>
                          <motion.button onClick={toggle} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-2xl" style={{ background: acc }}>{playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="translate-x-0.5" />}</motion.button>
                          <button onClick={next} className="text-white/30 hover:text-white transition-all transform hover:translate-x-1"><SkipForward size={24} /></button>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setShowFX(true)} className="p-3 rounded-xl transition-all hover:bg-white/5 text-white/20 hover:text-white"><Activity size={20} /></button>
                          <div className="h-8 w-[1px] bg-white/10" />
                          <div className="flex items-center gap-2">
                            <button onClick={() => setShuffle(!shuffle)} style={{ color: shuffle ? acc : "rgba(255,255,255,0.1)" }} className="p-1"><Shuffle size={16} /></button>
                            <button onClick={() => setLoop(!loop)} style={{ color: loop ? acc : "rgba(255,255,255,0.1)" }} className="p-1"><Repeat size={16} /></button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 pt-6 border-t border-white/[0.05]">
                        <Volume2 size={16} className="text-white/10" />
                        <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={e => { setVolume(parseFloat(e.target.value)); setMuted(false); }} className="flex-1 h-[3px] rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, ${acc}88 ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.05) ${(muted ? 0 : volume) * 100}%)`, accentColor: acc }} />
                      </div>
                    </div>
                  </div>
                </div>

                {!showQueue && (
                  <button onClick={() => setShowQueue(true)} className="absolute right-0 top-1/2 -translate-y-1/2 p-4 pt-10 pb-10 bg-white/[0.02] hover:bg-white/[0.05] border-l border-white/[0.05] rounded-l-3xl transition-all group flex flex-col items-center gap-4">
                    <ListMusic size={20} className="text-white/20 group-hover:text-white" />
                    <span className="[writing-mode:vertical-lr] text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-white mt-2">Neural Queue</span>
                  </button>
                )}
              </div>

              {/* NEURAL QUEUE (LIBRARY) */}
              <AnimatePresence>
                {showQueue && (
                  <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 420, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", damping: 30, stiffness: 250 }} className="h-full border-l border-white/[0.08] flex flex-col bg-black/40 backdrop-blur-3xl shrink-0 overflow-hidden relative">
                    <div className="p-7 border-b border-white/[0.05] flex flex-col gap-5 bg-white/[0.01]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ListMusic size={16} style={{ color: acc }} />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/90">Neural Library</h3>
                        </div>
                        <button onClick={() => setShowQueue(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/20 hover:text-white">
                          <Maximize2 size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" />
                          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="SYNC ARTIST..." className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-3 pl-11 pr-4 text-[11px] font-black tracking-widest text-white uppercase placeholder:text-white/10 focus:outline-none focus:border-white/20 transition-all font-mono" />
                        </div>
                        <button onClick={doSearch} className="w-12 h-12 rounded-2xl flex items-center justify-center text-black shadow-xl" style={{ background: acc }}>
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-none space-y-1">
                      {tracks.map((t, i) => (
                        <TrackRow key={t.id} track={t} index={i} current={i === idx} playing={playing} accent={acc} onClick={() => loadTrack(i)} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : activeTab === "games" ? (
            <motion.div key="games" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-1 flex items-center justify-center px-8 sm:px-12"><Pong /></motion.div>
          ) : (
            <motion.div key="vibes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-1 flex items-center justify-center px-8 sm:px-12">
              <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                {VIBES.map(v => (
                  <motion.button key={v.id} onClick={() => setVibe(v)} whileHover={{ scale: 1.02 }} className={`relative flex flex-col gap-4 p-8 rounded-3xl text-left transition-all border ${vibe.id === v.id ? "border-white/20 bg-white/[0.08]" : "border-white/[0.05] bg-white/[0.03]"}`}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: vibe.id === v.id ? v.accent + "28" : "rgba(255,255,255,0.05)" }}><v.Icon size={20} style={{ color: vibe.id === v.id ? v.accent : "rgba(255,255,255,0.2)" }} /></div>
                    <div><p className="text-white text-sm font-black uppercase tracking-widest">{v.label}</p><p className="text-white/20 text-[10px] uppercase font-bold tracking-widest mt-1.5">{v.sub}</p></div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-30 flex items-center justify-between px-8 py-4 border-t border-white/[0.05]">
        <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: acc }} /><span className="text-[10px] font-black uppercase tracking-widest text-white/20">{vibe.label} PROTOCOL ACTIVE</span></div>
        <button onClick={onExit} className="flex items-center gap-2 px-6 py-2 rounded-full border border-white/[0.05] text-[10px] font-black text-white/20 hover:text-red-500 hover:border-red-500/20 transition-all uppercase tracking-widest">Terminate Zone</button>
      </div>

      <AnimatePresence>
        {showFX && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 40 }} className="w-full max-w-[420px] bg-[#0c0c16] border border-white/10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">
              <div className="px-10 py-8 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/[0.03] shadow-inner"><Activity size={20} style={{ color: acc }} /></div><div><h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">Spectral Rack</h3><p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">High Fidelity Engine</p></div></div>
                <button onClick={() => setShowFX(false)} className="p-3 hover:bg-white/5 rounded-full transition-all group"><X size={18} className="text-white/20 group-hover:text-white group-hover:rotate-90 transition-all" /></button>
              </div>
              <div className="p-12 flex flex-col gap-10">
                <div className="flex flex-col gap-7">
                  <div className="flex flex-col gap-4"><div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/40"><span>Temporal Pitch</span><span className="font-mono text-white/80">{pitch.toFixed(2)}x</span></div><input type="range" min={0.5} max={1.5} step={0.05} value={pitch} onChange={e => setPitch(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, ${acc} ${(pitch - 0.5) * 100}%, rgba(255,255,255,0.05) ${(pitch - 0.5) * 100}%)`, accentColor: acc }} /></div>
                  <div className="flex flex-col gap-4"><div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/40"><span>Spatial Reverb</span><span className="font-mono text-white/80">{Math.round(reverb * 100)}%</span></div><input type="range" min={0} max={0.8} step={0.01} value={reverb} onChange={e => setReverb(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, ${acc} ${reverb / 0.8 * 100}%, rgba(255,255,255,0.05) ${reverb / 0.8 * 100}%)`, accentColor: acc }} /></div>
                </div>
                <div className="flex flex-col gap-5 p-7 bg-white/[0.01] border border-white/[0.06] rounded-[2.5rem] shadow-inner">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-2">Neural Equalizer</span>
                  {[{ l: "Bass", v: eqBass, s: setEqBass }, { l: "Mid", v: eqMid, s: setEqMid }, { l: "High", v: eqHigh, s: setEqHigh }].map(f => (
                    <div key={f.l} className="flex flex-col gap-2.5">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/40"><span>{f.l}</span><span className="font-mono text-white/60">{f.v}dB</span></div>
                      <input type="range" min={-12} max={12} value={f.v} onChange={e => f.s(parseInt(e.target.value))} className="w-full h-1 rounded-full appearance-none" style={{ background: `linear-gradient(to right, ${acc} ${(f.v + 12) / 24 * 100}%, rgba(255,255,255,0.05) ${(f.v + 12) / 24 * 100}%)`, accentColor: acc }} />
                    </div>
                  ))}
                </div>
                <button onClick={() => { setPitch(1); setReverb(0); setEqBass(0); setEqMid(0); setEqHigh(0); }} className="w-full py-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] text-[10px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white transition-all flex items-center justify-center gap-3"><RotateCcw size={14} /> Reset Signal Path</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
