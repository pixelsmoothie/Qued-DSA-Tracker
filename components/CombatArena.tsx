import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DuelOrchestrator, DuelPlayer, DuelResult } from '../lib/duelOrchestrator';
import { Swords, Trophy, Users, Send, Target, Clock, Bot, CheckCircle2, ChevronRight, X, Loader2 } from 'lucide-react';
import MissionEditor from './MissionEditor';
import { supabase } from '../lib/supabase';

export default function CombatArena({ userId, userName, daysElapsed = 0 }: { userId: string, userName: string, daysElapsed?: number }) {
  const [phase, setPhase] = useState<'lobby' | 'battle' | 'results'>('lobby');
  const [arenaKey, setArenaKey] = useState('');
  const [players, setPlayers] = useState<DuelPlayer[]>([]);
  const [activeProblem, setActiveProblem] = useState<any>(null);
  const [results, setResults] = useState<DuelResult[]>([]);
  const [opponentStatus, setOpponentStatus] = useState<Record<string, string>>({});
  const [isHost, setIsHost] = useState(false);
  const [judging, setJudging] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');

  const orchestrator = useRef<DuelOrchestrator | null>(null);

  useEffect(() => {
    orchestrator.current = new DuelOrchestrator(userId, userName, daysElapsed);

    orchestrator.current.onPlayerJoined = (p) => setPlayers(p);
    orchestrator.current.onProblemDrop = (prob) => {
      setActiveProblem(prob);
      setPhase('battle');
    };
    orchestrator.current.onOpponentProgress = (uid, status) => {
      setOpponentStatus(prev => ({ ...prev, [uid]: status }));
    };
    orchestrator.current.onResults = (res) => {
      setResults(res);
      setPhase('results');
    };

    return () => orchestrator.current?.cleanup();
  }, [userId, userName]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const key = await orchestrator.current?.createRoom();
      if (key) {
        setArenaKey(key);
        setIsHost(true);
      }
    } catch (e: any) {
      console.error("Combat Protocol Failure:", e);
      alert(`Battle Initialization Failed: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setLoading(true);
    try {
      await orchestrator.current?.joinRoom(inputKey);
      setArenaKey(inputKey);
    } catch (e) {
      alert("Invalid Arena Key");
    } finally {
      setLoading(false);
    }
  };

  const startBattle = async () => {
    // 1. Determine fairness threshold (min day among participants)
    const minDay = Math.min(...players.map(p => p.days_elapsed || 999), daysElapsed);

    // 2. We only want questions that are "solved" by the host AND are before minDay
    // For fair play, questions before minDay are those where id <= (minDay - 1) * 2
    const fairnessLimit = (minDay - 1) * 2;

    // Fetch from Supabase problems table
    // We assume the problems table has an 'id' that maps to the strivers sheet
    const { data: eligibleProbs } = await supabase
      .from('problems')
      .select('*')
      .lte('id', fairnessLimit);

    if (eligibleProbs && eligibleProbs.length > 0) {
      // Pick a random one from eligible
      const randomProb = eligibleProbs[Math.floor(Math.random() * eligibleProbs.length)];
      await orchestrator.current?.startDuel(randomProb.id);
    } else {
      // Fallback: Pick the first available problem if no fairness match (e.g. at very low levels)
      const { data: fallback } = await supabase.from('problems').select('*').limit(1).single();
      if (fallback) {
        await orchestrator.current?.startDuel(fallback.id);
      } else {
        alert("Vital Error: Combat Library is empty.");
      }
    }
  };

  const handleSubmit = async () => {
    await orchestrator.current?.submitCode(code, 'typescript');
    setOpponentStatus(prev => ({ ...prev, [userId]: 'submitted' }));
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-claude-bg overflow-hidden relative">
      <AnimatePresence mode="wait">
        {/* ── LOBBY VIEW ────────────────────────────────────── */}
        {phase === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex items-center justify-center p-12"
          >
            <div className="w-full max-w-lg bg-claude-panel border border-claude-border rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-claude-accent/5 blur-3xl rounded-full" />
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-claude-accent/10 flex items-center justify-center mb-6 border border-claude-accent/20">
                  <Swords className="text-claude-accent" size={32} />
                </div>
                <h1 className="text-3xl font-medium tracking-tight mb-2">Combat Arena</h1>
                <p className="text-sm text-claude-muted mb-10">Challenge your collective to a synchronized solving ritual.</p>

                {!arenaKey ? (
                  <div className="w-full space-y-4">
                    <button onClick={handleCreate} disabled={loading} className="w-full py-4 bg-claude-accent text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3">
                      {loading ? <Loader2 className="animate-spin" /> : <Target size={14} />} Create New Arena
                    </button>
                    <div className="flex items-center gap-4 py-2">
                      <div className="h-px flex-1 bg-claude-border/50" />
                      <span className="text-[10px] font-black uppercase text-claude-muted tracking-widest">or Join</span>
                      <div className="h-px flex-1 bg-claude-border/50" />
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                        placeholder="Arena Key..."
                        className="flex-1 bg-claude-bg/50 border border-claude-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-claude-accent"
                      />
                      <button onClick={handleJoin} disabled={loading} className="px-6 bg-claude-hover hover:bg-claude-border text-claude-text rounded-xl font-bold uppercase tracking-widest text-xs flex items-center">
                        Connect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full space-y-8">
                    <div className="p-6 bg-claude-bg/50 border border-dashed border-claude-border rounded-3xl flex flex-col items-center gap-3">
                      <span className="text-[10px] font-black uppercase text-claude-muted tracking-[0.3em]">Invite Protocol Key</span>
                      <span className="text-4xl font-mono font-black text-claude-accent tracking-[0.2em]">{arenaKey}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase text-claude-muted tracking-widest px-1">
                        <span>Connected Peers</span>
                        <span>{players.length} / 5</span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {players.map(p => (
                          <div key={p.user_id} className="px-4 py-2 bg-claude-hover rounded-xl border border-claude-border/50 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-xs font-medium text-claude-text">{p.display_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={startBattle} className="w-full py-5 bg-claude-accent text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(218,119,86,0.3)]">
                      Commence Challenge
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── BATTLE VIEW ────────────────────────────────────── */}
        {phase === 'battle' && activeProblem && (
          <motion.div
            key="battle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex overflow-hidden lg:flex-row flex-col"
          >
            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-claude-panel border-r border-claude-border">
              <header className="h-14 shrink-0 border-b border-claude-border/40 bg-claude-hover/20 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                  <Swords className="text-claude-accent" size={18} />
                  <h2 className="text-sm font-bold tracking-tight uppercase text-claude-text/80">{activeProblem.title}</h2>
                </div>
                <div className="flex items-center gap-6">
                  {isHost && (
                    <button
                      onClick={async () => {
                        setJudging(true);
                        try {
                          await orchestrator.current?.triggerJudge(true);
                        } catch (e: any) {
                          // Try to extract the JSON error message from Supabase response
                          const errorDetails = e.context?.statusText || e.message || "Protocol Failure";
                          alert(`Judging Error: ${errorDetails}`);
                        } finally {
                          setJudging(false);
                        }
                      }}
                      disabled={judging}
                      className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-claude-hover text-claude-accent border border-claude-accent/20 hover:bg-claude-accent/10 transition-all disabled:opacity-50"
                    >
                      {judging ? 'Ranking...' : 'Force Finalize'}
                    </button>
                  )}
                  <div className="flex items-center gap-2 text-claude-muted">
                    <Clock size={14} />
                    <span className="text-xs font-mono font-bold tracking-widest">LIVE COMBAT</span>
                  </div>
                  <button onClick={handleSubmit} disabled={opponentStatus[userId] === 'submitted'} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${opponentStatus[userId] === 'submitted' ? 'bg-green-500/10 text-green-400 opacity-50 cursor-not-allowed' : 'bg-claude-accent text-white hover:scale-105 shadow-lg'}`}>
                    {opponentStatus[userId] === 'submitted' ? 'Submitted' : 'Finalize & Submit'}
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-hidden">
                <MissionEditor
                  activeMission={{ id: activeProblem.id, name: activeProblem.title, description: activeProblem.description, leetcode_url: '#' }}
                  onCodeChange={(n: string) => setCode(n)}
                />
              </div>
            </div>

            {/* Participation Sidebar */}
            <aside className="w-full lg:w-72 shrink-0 bg-claude-bg flex flex-col p-6 gap-6">
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-claude-muted">Arena Pulse</h3>
                <div className="space-y-3">
                  {players.map(p => (
                    <div key={p.user_id} className="p-4 bg-claude-panel border border-claude-border rounded-2xl flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-claude-text">{p.display_name}</span>
                        {opponentStatus[p.user_id] === 'submitted' ? (
                          <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-black uppercase tracking-widest">
                            <CheckCircle2 size={12} /> Ready
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-claude-muted text-[10px] font-bold uppercase tracking-widest">
                            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 rounded-full bg-claude-accent" /> Coding
                          </div>
                        )}
                      </div>
                      <div className="h-1 bg-claude-hover rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: opponentStatus[p.user_id] === 'submitted' ? '100%' : '15%' }}
                          className="h-full bg-claude-accent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto p-5 bg-claude-accent/5 border border-claude-accent/10 rounded-3xl">
                <div className="flex items-center gap-3 mb-2">
                  <Bot className="text-claude-accent" size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-claude-accent">AI Judge Protocol</span>
                </div>
                <p className="text-[10px] text-claude-muted leading-relaxed">
                  The Process Core will rank all submissions based on approach, complexity, and performance markers once the ritual concludes.
                </p>
              </div>
            </aside>
          </motion.div>
        )}

        {/* ── RESULTS VIEW ─────────────────────────────────────── */}
        {phase === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex items-center justify-center p-12 overflow-y-auto"
          >
            <div className="w-full max-w-4xl space-y-10 py-10">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-claude-accent/10 flex items-center justify-center mb-6 shadow-inner border border-claude-accent/20">
                  <Trophy className="text-claude-accent" size={40} />
                </div>
                <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Duel Concluded</h1>
                <p className="text-claude-muted text-sm font-medium tracking-wide">The Relative Ranking Protocol has finalized the assessment.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((res, idx) => (
                  <motion.div
                    key={res.user_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`relative group bg-claude-panel border border-claude-border rounded-[2rem] p-8 shadow-xl ${res.rank === 1 ? 'ring-2 ring-claude-accent ring-offset-4 ring-offset-claude-bg' : ''}`}
                  >
                    <div className="absolute top-6 right-8 text-5xl font-black italic opacity-5 group-hover:opacity-10 transition-opacity">
                      #{res.rank}
                    </div>
                    <div className="flex flex-col items-center text-center mb-6">
                      <span className="text-[10px] font-black uppercase tracking-widest text-claude-muted mb-4 px-3 py-1 bg-claude-hover rounded-full">
                        {players.find(p => p.user_id === res.user_id)?.display_name}
                      </span>
                      <div className="text-5xl font-black text-claude-accent tracking-tighter mb-1">{res.score}</div>
                      <span className="text-[8px] font-black uppercase tracking-[0.4em] text-claude-muted">System Score</span>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-claude-border/30">
                      <div>
                        <h4 className="text-[10px] font-bold text-claude-accent uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Bot size={12} /> AI Assessment
                        </h4>
                        <p className="text-xs leading-relaxed text-claude-text/70">{res.feedback}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-claude-muted uppercase tracking-widest mb-2">Key Insight</h4>
                        <p className="text-xs font-medium text-claude-text leading-relaxed">{res.key_insight}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center pt-8">
                <button onClick={() => window.location.reload()} className="px-10 py-4 bg-claude-hover hover:bg-claude-border border border-claude-border rounded-2xl text-xs font-black uppercase tracking-widest text-claude-accent transition-all shadow-xl">
                  Return to Mission Hub
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}
