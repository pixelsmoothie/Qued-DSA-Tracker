"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Level = "simple" | "medium" | "panic";
type InputMode = "mouse" | "keyboard";
type GameState = "idle" | "playing" | "gameover";

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  color: string;
}

interface TrailPoint {
  x: number;
  y: number;
  o: number;
}

const W = 800;
const H = 380;
const PW = 10;
const PH = 80;
const WIN_SCORE = 7;
const MAX_BALL_SPEED = 14;

const BASE_SPEED: Record<Level, number> = { simple: 5.5, medium: 6.5, panic: 8.5 };
const AI_REACT: Record<Level, number> = { simple: 0.06, medium: 0.10, panic: 0.16 };

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function buildObstacles(level: Level): Obstacle[] {
  if (level === "simple") return [];
  if (level === "medium") return [
    { x: W * 0.33, y: H * 0.15, w: 12, h: 80, vy: 0, color: "#818cf8" },
    { x: W * 0.66, y: H * 0.55, w: 12, h: 80, vy: 0, color: "#818cf8" },
  ];
  return [
    { x: W * 0.25, y: H * 0.1, w: 12, h: 60, vy: 2.2, color: "#f472b6" },
    { x: W * 0.5, y: H * 0.4, w: 12, h: 60, vy: -1.8, color: "#fb923c" },
    { x: W * 0.75, y: H * 0.2, w: 12, h: 60, vy: 2.5, color: "#f472b6" },
  ];
}

export default function Pong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>("idle");
  const levelRef = useRef<Level>("simple");
  const inputModeRef = useRef<InputMode>("mouse");
  const keys = useRef(new Set<string>());
  const rafId = useRef<number | null>(null);

  const ball = useRef({ x: W / 2, y: H / 2, vx: 0, vy: 0, trail: [] as TrailPoint[] });
  const playerY = useRef(H / 2 - PH / 2);
  const aiY = useRef(H / 2 - PH / 2);
  const obstacles = useRef<Obstacle[]>([]);
  const scoreRef = useRef({ player: 0, ai: 0 });

  const [displayScore, setDisplayScore] = useState({ player: 0, ai: 0 });
  const [gameState, setGameState] = useState<GameState>("idle");
  const [level, setLevel] = useState<Level>("simple");
  const [inputMode, setInputMode] = useState<InputMode>("mouse");
  const [statusMsg, setStatusMsg] = useState("PRESS START COMMAND");

  const resetBall = useCallback((dir?: 1 | -1) => {
    const spd = BASE_SPEED[levelRef.current];
    const b = ball.current;
    b.x = W / 2; b.y = H / 2; b.trail = [];
    b.vx = (dir ?? (Math.random() > 0.5 ? 1 : -1)) * spd;
    b.vy = (Math.random() - 0.5) * spd * 0.9;
  }, []);

  const fullReset = useCallback(() => {
    scoreRef.current = { player: 0, ai: 0 };
    setDisplayScore({ player: 0, ai: 0 });
    playerY.current = H / 2 - PH / 2;
    aiY.current = H / 2 - PH / 2;
    obstacles.current = buildObstacles(levelRef.current);
    resetBall();
    gameStateRef.current = "idle";
    setGameState("idle");
    setStatusMsg("MATRIX READY");
  }, [resetBall]);

  const startOrRetry = useCallback(() => {
    if (gameStateRef.current === "gameover") {
      scoreRef.current = { player: 0, ai: 0 };
      setDisplayScore({ player: 0, ai: 0 });
      playerY.current = H / 2 - PH / 2;
      aiY.current = H / 2 - PH / 2;
      obstacles.current = buildObstacles(levelRef.current);
      resetBall();
    }
    gameStateRef.current = "playing";
    setGameState("playing");
    setStatusMsg(`${levelRef.current.toUpperCase()} PROTOCOL ACTIVE`);
  }, [resetBall]);

  const rectBallCollide = useCallback((o: Obstacle) => {
    const b = ball.current;
    const r = 6;
    if (b.x + r < o.x || b.x - r > o.x + o.w) return;
    if (b.y + r < o.y || b.y - r > o.y + o.h) return;
    const overlapL = (b.x + r) - o.x;
    const overlapR = (o.x + o.w) - (b.x - r);
    const overlapT = (b.y + r) - o.y;
    const overlapB = (o.y + o.h) - (b.y - r);
    const minX = Math.min(overlapL, overlapR);
    const minY = Math.min(overlapT, overlapB);
    if (minX < minY) {
      b.vx = -b.vx;
      b.x += overlapL < overlapR ? -overlapL : overlapR;
    } else {
      b.vy = -b.vy;
      b.y += overlapT < overlapB ? -overlapT : overlapB;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let lastTs = 0;

    const update = (dt: number) => {
      const f = Math.min(dt / 16.66, 2.5);
      const b = ball.current;

      if (inputModeRef.current === "keyboard") {
        const spd = 7;
        if (keys.current.has("w") || keys.current.has("ArrowUp"))
          playerY.current = clamp(playerY.current - spd * f, 0, H - PH);
        if (keys.current.has("s") || keys.current.has("ArrowDown"))
          playerY.current = clamp(playerY.current + spd * f, 0, H - PH);
      }

      b.x += b.vx * f;
      b.y += b.vy * f;
      b.trail.push({ x: b.x, y: b.y, o: 1 });
      if (b.trail.length > 14) b.trail.shift();
      for (const t of b.trail) t.o -= 0.07 * f;

      if (b.y < 6) { b.y = 6; b.vy = Math.abs(b.vy); }
      if (b.y > H - 6) { b.y = H - 6; b.vy = -Math.abs(b.vy); }

      for (const o of obstacles.current) {
        if (o.vy !== 0) {
          o.y += o.vy * f;
          if (o.y < 0 || o.y + o.h > H) { o.vy = -o.vy; o.y = clamp(o.y, 0, H - o.h); }
        }
        rectBallCollide(o);
      }

      const aiTarget = b.y - PH / 2;
      aiY.current += (aiTarget - aiY.current) * AI_REACT[levelRef.current] * f;
      aiY.current = clamp(aiY.current, 0, H - PH);

      const speed = Math.hypot(b.vx, b.vy);

      if (b.x - 6 <= 20 && b.vx < 0) {
        if (b.y > playerY.current && b.y < playerY.current + PH) {
          b.x = 26;
          const hitPos = (b.y - (playerY.current + PH / 2)) / (PH / 2);
          const newSpd = Math.min(speed * 1.04, MAX_BALL_SPEED);
          b.vx = Math.abs(newSpd * Math.cos(hitPos * 0.9));
          b.vy = newSpd * Math.sin(hitPos * 1.1);
        }
      }

      if (b.x + 6 >= W - 20 && b.vx > 0) {
        if (b.y > aiY.current && b.y < aiY.current + PH) {
          b.x = W - 26;
          const hitPos = (b.y - (aiY.current + PH / 2)) / (PH / 2);
          const newSpd = Math.min(speed * 1.04, MAX_BALL_SPEED);
          b.vx = -Math.abs(newSpd * Math.cos(hitPos * 0.9));
          b.vy = newSpd * Math.sin(hitPos * 1.1);
        }
      }

      if (b.x < 0) {
        scoreRef.current.ai++;
        setDisplayScore({ ...scoreRef.current });
        if (scoreRef.current.ai >= WIN_SCORE) {
          gameStateRef.current = "gameover";
          setGameState("gameover");
          setStatusMsg("AI CORE OVERLOADED - YOU LOST");
          return;
        }
        resetBall(1);
      }

      if (b.x > W) {
        scoreRef.current.player++;
        setDisplayScore({ ...scoreRef.current });
        if (scoreRef.current.player >= WIN_SCORE) {
          gameStateRef.current = "gameover";
          setGameState("gameover");
          setStatusMsg("NEURAL DOMINANCE ACHIEVED");
          return;
        }
        resetBall(-1);
      }
    };

    const draw = () => {
      const b = ball.current;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);

      for (const o of obstacles.current) {
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }

      b.trail.forEach((t, i) => {
        ctx.fillStyle = `rgba(129,140,248,${Math.max(0, t.o * 0.35)})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, 3 + i / 3, 0, Math.PI * 2); ctx.fill();
      });

      ctx.shadowBlur = 15;
      ctx.shadowColor = "rgba(129,140,248,0.7)";
      ctx.fillStyle = "#fff";
      ctx.fillRect(10, playerY.current, PW, PH);
      ctx.fillRect(W - 20, aiY.current, PW, PH);
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      if (gameStateRef.current === "idle" || gameStateRef.current === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "center";
        const msg = gameStateRef.current === "gameover"
          ? (scoreRef.current.player >= WIN_SCORE ? "VICTORY" : "DEFEAT")
          : "NEURAL PONG";
        ctx.fillText(msg, W / 2, H / 2 - 10);
        ctx.font = "400 12px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(
          gameStateRef.current === "gameover" ? "RE-INITIATE: SPACE / CLICK" : "INITIATE: SPACE / CLICK",
          W / 2, H / 2 + 20
        );
        ctx.textAlign = "left";
      }
    };

    const frame = (ts: number) => {
      const dt = lastTs ? ts - lastTs : 16.66;
      lastTs = ts;
      if (gameStateRef.current === "playing") update(dt);
      draw();
      rafId.current = requestAnimationFrame(frame);
    };

    rafId.current = requestAnimationFrame(frame);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [rectBallCollide, resetBall]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key);
      if (e.key === " ") { e.preventDefault(); startOrRetry(); }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startOrRetry]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (inputModeRef.current !== "mouse") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const my = (e.clientY - rect.top) * (H / rect.height);
    playerY.current = clamp(my - PH / 2, 0, H - PH);
  };

  const handleLevelChange = (l: Level) => {
    levelRef.current = l;
    setLevel(l);
    fullReset();
  };

  const handleInputChange = (m: InputMode) => {
    inputModeRef.current = m;
    setInputMode(m);
  };

  const btnBase = "px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-md border transition-all cursor-pointer";
  const btnActive = "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]";
  const btnInactive = "bg-transparent text-white/30 border-white/10 hover:border-white/30 hover:text-white/60";

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl select-none font-mono">
      <div className="flex gap-4 flex-wrap items-center bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mr-2">Difficulty</span>
          {(["simple", "medium", "panic"] as Level[]).map(l => (
            <button key={l} onClick={() => handleLevelChange(l)}
              className={`${btnBase} ${level === l ? btnActive : btnInactive}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mr-2">Interface</span>
          {(["mouse", "keyboard"] as InputMode[]).map(m => (
            <button key={m} onClick={() => handleInputChange(m)}
              className={`${btnBase} ${inputMode === m ? btnActive : btnInactive}`}>
              {m === "keyboard" ? "Keys" : "Mouse"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Subject</span>
          <span className="text-2xl font-black text-white">{displayScore.player}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black tracking-[0.3em] text-indigo-400 uppercase animate-pulse">{statusMsg}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Neural AI</span>
          <span className="text-2xl font-black text-white">{displayScore.ai}</span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerMove={handlePointerMove}
          onPointerDown={() => startOrRetry()}
          className="w-full h-auto block touch-none"
          style={{ cursor: inputMode === "mouse" ? "none" : "default" }}
        />
      </div>

      <div className="flex justify-between items-center px-4">
        <p className="text-[9px] font-medium text-white/20 uppercase tracking-[0.2em]">
          {inputMode === "keyboard" ? "W / S or Arrows to adjust vector" : "Link active: 1:1 Vector tracking"}
        </p>
        <p className="text-[9px] font-medium text-white/20 uppercase tracking-[0.2em]">
          First to {WIN_SCORE} Dominates Matrix
        </p>
      </div>
    </div>
  );
}
